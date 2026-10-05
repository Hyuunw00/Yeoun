import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperGrain } from '@/components/library/paper-grain';
import { LibraryFonts } from '@/components/library/theme';
import { MapColors } from '@/components/travel/theme';
import { useDb } from '@/lib/database';
import { formatTripDates, tripLength } from '@/lib/date';
import { hasTravelRecord, saveRecord } from '@/lib/db';
import { loadHome, type HomeCity } from '@/lib/home';
import { groupTrips, nameTrip, scanPhotos, type PhotoTrip } from '@/lib/photo-trips';
import { MAX_TRAVEL_PHOTOS, persistPhoto, resizePhotoFile } from '@/lib/photos';
import type { City } from '@/lib/places';

const PERIODS = [
  { label: '최근 1년', years: 1 },
  { label: '최근 3년', years: 3 },
  { label: '전체', years: null },
] as const;
const GRID_COLUMNS = 4;
const GRID_GAP = 4;

type Candidate = {
  trip: PhotoTrip;
  city: City | null;
  // Editable: the geocoder may name it in English or by a ward
  name: string;
  include: boolean;
  // Already recorded (same city, same first day)
  exists: boolean;
  selected: string[];
};

type Phase =
  { step: 'intro' } | { step: 'scanning'; label: string } | { step: 'review' } | { step: 'importing'; label: string };

const photoSource = (id: string) => ({ uri: `ph://${id}` });
const cityLine = (city: City | null) => [city?.region, city?.country].filter(Boolean).join(' · ');

// Bringing in past trips from the photo library: photos taken away from home are grouped
// into city visits, and the ones picked are saved with the photos chosen for each
export default function ImportTripsScreen() {
  const db = useDb();
  const { width } = useWindowDimensions();
  const [home, setHome] = useState<HomeCity | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ step: 'intro' });
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  // Index of the candidate whose photos are being picked
  const [picking, setPicking] = useState<number | null>(null);

  useEffect(() => {
    loadHome().then(setHome);
  }, []);

  function update(index: number, change: Partial<Candidate>) {
    setCandidates((prev) => prev.map((c, i) => (i === index ? { ...c, ...change } : c)));
  }

  async function scan(years: number | null) {
    if (!home) return;
    const permission = await requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 접근이 필요해요', '설정에서 사진 접근을 허용해주세요');
      return;
    }
    if (permission.accessPrivileges === 'limited') {
      Alert.alert('선택한 사진만 볼 수 있어요', '모든 사진을 훑으려면 설정에서 전체 접근을 허용해주세요');
    }
    try {
      setPhase({ step: 'scanning', label: '사진을 모으는 중' });
      const photos = await scanPhotos(years, (done, total) =>
        setPhase({ step: 'scanning', label: `사진 위치 확인 중 ${done.toLocaleString()} / ${total.toLocaleString()}` }),
      );
      const trips = groupTrips(photos, home);
      const found: Candidate[] = [];
      for (const [i, trip] of trips.entries()) {
        setPhase({ step: 'scanning', label: `도시 이름 찾는 중 ${i + 1} / ${trips.length}` });
        const city = await nameTrip(trip).catch(() => null);
        const exists = city ? await hasTravelRecord(db, city.externalId, trip.start) : false;
        found.push({ trip, city, name: city?.name ?? '', include: false, exists, selected: [] });
      }
      setCandidates(found);
      setPhase({ step: 'review' });
    } catch {
      Alert.alert('사진을 훑지 못했어요', '잠시 후 다시 시도해주세요');
      setPhase({ step: 'intro' });
    }
  }

  function togglePhoto(index: number, id: string) {
    const { selected } = candidates[index];
    if (selected.includes(id)) {
      update(index, { selected: selected.filter((s) => s !== id) });
    } else if (selected.length < MAX_TRAVEL_PHOTOS) {
      Haptics.selectionAsync();
      // Picking photos means this trip is wanted
      update(index, { selected: [...selected, id], include: true });
    }
  }

  async function importPicked() {
    if (!home) return;
    const picked = candidates.filter((c) => c.include && c.city && c.name.trim());
    if (picked.length === 0) return;
    try {
      for (const [i, c] of picked.entries()) {
        const city = c.city!;
        const photoNames: string[] = [];
        // In the order they were taken
        const ids = c.trip.photoIds.filter((id) => c.selected.includes(id));
        for (const [j, id] of ids.entries()) {
          setPhase({ step: 'importing', label: `${c.name} 가져오는 중 · 사진 ${j + 1} / ${ids.length}` });
          const asset = new Asset(id);
          const [uri, shape] = await Promise.all([asset.getUri(), asset.getShape()]);
          const temp = await resizePhotoFile(uri, shape?.width ?? 0, shape?.height ?? 0);
          photoNames.push(await persistPhoto(temp));
        }
        setPhase({ step: 'importing', label: `${c.name} 저장하는 중 (${i + 1} / ${picked.length})` });
        await saveRecord(
          db,
          {
            category: 'travel',
            externalId: city.externalId,
            title: c.name.trim(),
            subtitle: cityLine(city) || null,
            year: null,
            releaseDate: null,
            imageUrl: null,
            latitude: city.latitude,
            longitude: city.longitude,
            countryCode: city.countryCode,
          },
          {
            body: '',
            experiencedOn: c.trip.start,
            endedOn: c.trip.end > c.trip.start ? c.trip.end : null,
            episode: null,
            rating: null,
            transport: null,
            origin: JSON.stringify(home),
          },
          photoNames,
        );
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('가져오지 못한 여행이 있어요', '잠시 후 다시 시도해주세요');
      setPhase({ step: 'review' });
    }
  }

  const includedCount = candidates.filter((c) => c.include).length;
  const tile = (width - 40 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const current = picking !== null ? candidates[picking] : null;

  return (
    <View style={styles.container}>
      <PaperGrain opacity={0.14} />
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} disabled={phase.step === 'importing'}>
            <Text style={styles.headerButton}>닫기</Text>
          </Pressable>
          {phase.step === 'review' && (
            <Pressable onPress={importPicked} disabled={includedCount === 0} hitSlop={12}>
              <Text style={[styles.save, includedCount === 0 && styles.disabled]}>{includedCount}곳 가져오기</Text>
            </Pressable>
          )}
        </View>

        {phase.step === 'intro' && (
          <View style={styles.intro}>
            <Text style={styles.title}>사진에서 여행 불러오기</Text>
            <Text style={styles.text}>
              사는 곳에서 멀리 떨어진 곳에서 찍은 사진을 날짜와 도시별로 묶어 보여줘요. 가져올 여행과 사진은 직접
              골라요.
            </Text>
            {home === null ? (
              <Pressable
                style={styles.button}
                onPress={() => router.push({ pathname: '/travel/search', params: { mode: 'home' } })}>
                <Text style={styles.buttonText}>먼저 사는 곳 정하기</Text>
              </Pressable>
            ) : (
              home && (
                <>
                  <Text style={styles.text}>🏠 {home.name} 기준</Text>
                  {PERIODS.map((p) => (
                    <Pressable key={p.label} style={styles.button} onPress={() => scan(p.years)}>
                      <Text style={styles.buttonText}>{p.label} 사진 훑어보기</Text>
                    </Pressable>
                  ))}
                </>
              )
            )}
          </View>
        )}

        {(phase.step === 'scanning' || phase.step === 'importing') && (
          <View style={styles.intro}>
            <ActivityIndicator color={MapColors.inkDim} />
            <Text style={styles.text}>{phase.label}</Text>
          </View>
        )}

        {phase.step === 'review' && (
          <FlatList
            data={candidates}
            keyExtractor={(item) => item.trip.key}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.text}>이 기간에는 여행 사진을 찾지 못했어요</Text>}
            renderItem={({ item, index }) => (
              <View style={[styles.card, item.include && styles.cardOn]}>
                <View style={styles.cardHead}>
                  <Pressable
                    onPress={() => update(index, { include: !item.include })}
                    hitSlop={10}
                    disabled={!item.city}>
                    <SymbolView
                      name={item.include ? 'checkmark.square.fill' : 'square'}
                      tintColor={item.include ? MapColors.pin : MapColors.inkDim}
                      size={22}
                    />
                  </Pressable>
                  <View style={styles.cardMain}>
                    <TextInput
                      style={styles.name}
                      value={item.name}
                      onChangeText={(name) => update(index, { name })}
                      placeholder={item.city ? '도시 이름' : '위치를 알 수 없어요'}
                      placeholderTextColor={MapColors.inkDim}
                      editable={!!item.city}
                    />
                    <Text style={styles.meta}>
                      {[
                        cityLine(item.city),
                        formatTripDates(item.trip.start, item.trip.end),
                        tripLength(item.trip.start, item.trip.end),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {item.exists && <Text style={styles.exists}>이미 기록한 여행이에요</Text>}
                  </View>
                </View>
                {/* A peek at the trip; tap to choose which photos come along */}
                <Pressable style={styles.strip} onPress={() => setPicking(index)}>
                  {(item.selected.length ? item.selected : item.trip.photoIds).slice(0, 5).map((id) => (
                    <Image key={id} source={photoSource(id)} style={styles.stripPhoto} contentFit="cover" />
                  ))}
                  <View style={styles.pickButton}>
                    <Text style={styles.pickText}>
                      사진 고르기 {item.selected.length}/{Math.min(MAX_TRAVEL_PHOTOS, item.trip.photoIds.length)}
                    </Text>
                    <Text style={styles.meta}>전체 {item.trip.photoIds.length}장</Text>
                  </View>
                </Pressable>
              </View>
            )}
          />
        )}
      </SafeAreaView>

      <Modal
        visible={current !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPicking(null)}>
        {current && picking !== null && (
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {current.name || '사진 고르기'} · {current.selected.length}/{MAX_TRAVEL_PHOTOS}
              </Text>
              <Pressable onPress={() => setPicking(null)} hitSlop={12}>
                <Text style={styles.save}>완료</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.grid}>
              {current.trip.photoIds.map((id) => {
                const order = current.selected.indexOf(id);
                return (
                  <Pressable key={id} onPress={() => togglePhoto(picking, id)}>
                    <Image
                      source={photoSource(id)}
                      style={[{ width: tile, height: tile }, order >= 0 && styles.chosen]}
                      contentFit="cover"
                    />
                    {order >= 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{order + 1}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MapColors.sea,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerButton: {
    fontFamily: LibraryFonts.serif,
    fontSize: 14,
    color: MapColors.inkDim,
  },
  save: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 15,
    color: MapColors.pin,
  },
  disabled: {
    opacity: 0.35,
  },
  intro: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 14,
  },
  title: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 22,
    color: MapColors.ink,
  },
  text: {
    fontFamily: LibraryFonts.serif,
    fontSize: 14,
    lineHeight: 22,
    color: MapColors.inkDim,
  },
  button: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MapColors.coast,
    backgroundColor: MapColors.paper,
  },
  buttonText: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 15,
    color: MapColors.ink,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    padding: 14,
    gap: 12,
    backgroundColor: MapColors.paper,
    borderWidth: 1,
    borderColor: MapColors.coast,
    opacity: 0.85,
  },
  cardOn: {
    opacity: 1,
    borderColor: MapColors.pin,
  },
  cardHead: {
    flexDirection: 'row',
    gap: 12,
  },
  cardMain: {
    flex: 1,
    gap: 4,
  },
  name: {
    paddingVertical: 2,
    fontFamily: LibraryFonts.serifBold,
    fontSize: 18,
    color: MapColors.ink,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MapColors.coast,
  },
  meta: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: MapColors.inkDim,
  },
  exists: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 12,
    color: MapColors.pin,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stripPhoto: {
    width: 44,
    height: 44,
    backgroundColor: MapColors.land,
  },
  pickButton: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
  },
  pickText: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 13,
    color: MapColors.ink,
  },
  sheet: {
    flex: 1,
    backgroundColor: MapColors.sea,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  sheetTitle: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 16,
    color: MapColors.ink,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  chosen: {
    opacity: 0.75,
    borderWidth: 3,
    borderColor: MapColors.pin,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: MapColors.pin,
  },
  badgeText: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 11,
    color: MapColors.paper,
  },
});
