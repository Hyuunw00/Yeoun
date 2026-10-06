import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { CinemaFonts } from '@/components/cinema/theme';
import { LibraryFonts } from '@/components/library/theme';
import { MapPaper } from '@/components/travel/map-paper';
import { Postcard } from '@/components/travel/postcard';
import { Snapshots } from '@/components/travel/snapshots';
import { MapColors } from '@/components/travel/theme';
import { asTransport } from '@/components/travel/transport';
import { TripTicket } from '@/components/travel/trip-ticket';
import { useDb } from '@/lib/database';
import { formatTripDates, tripLength } from '@/lib/date';
import { deleteRecord, getWork, listRecords, setWorkCover, type RecordEntry, type Work } from '@/lib/db';
import { parseOrigin } from '@/lib/home';
import { photoUri } from '@/lib/photos';
import type { City } from '@/lib/places';

const formatDate = (date: string) => date.replaceAll('-', '.');
const NOTE_MAX = 60;
const firstLine = (text: string) => {
  const line = text.trim().split('\n')[0];
  return line.length > NOTE_MAX ? `${line.slice(0, NOTE_MAX)}…` : line;
};

// Passport stamp inks and tilts, cycled per visit
const STAMP_INKS = ['#a3241c', '#2f4f7a', '#3e6b45', '#6b3f7a'];
const STAMP_TILTS = ['-8deg', '5deg', '-3deg', '9deg'];
// Stamps are struck one after another once the page has settled
const STAMP_FIRST_DELAY_MS = 450;
const STAMP_GAP_MS = 220;
const STAMP_STRIKE_MS = 170;
// Only the first few strikes tap the phone
const MAX_STAMP_TAPS = 6;
const COVER_COLUMNS = 3;
const COVER_GAP = 6;

function strikeTap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

// Pressed down from above: it lands bigger and faint, then sits flat at full ink
function Stamp({ code, name, date, index }: { code: string; name: string; date: string; index: number }) {
  const ink = STAMP_INKS[index % STAMP_INKS.length];
  const tilt = STAMP_TILTS[index % STAMP_TILTS.length];
  const pressed = useSharedValue(0);
  useEffect(() => {
    const taps = index < MAX_STAMP_TAPS;
    pressed.set(
      withDelay(
        STAMP_FIRST_DELAY_MS + index * STAMP_GAP_MS,
        withTiming(1, { duration: STAMP_STRIKE_MS, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished && taps) scheduleOnRN(strikeTap);
        }),
      ),
    );
  }, [pressed, index]);
  const strike = useAnimatedStyle(() => ({
    opacity: 0.85 * pressed.get(),
    transform: [{ scale: 1.7 - 0.7 * pressed.get() }, { rotate: tilt }],
  }));
  return (
    <Animated.View style={[styles.stamp, { borderColor: ink }, strike]}>
      <Text style={[styles.stampCode, { color: ink }]}>{code}</Text>
      <Text style={[styles.stampName, { color: ink }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.stampDate, { color: ink }]}>{formatDate(date)}</Text>
    </Animated.View>
  );
}

// A city kept as a postcard: the front shows a photo picked from the trips, every visit
// adds a passport stamp, and each trip is kept as the ticket it was made on
export default function CityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { width } = useWindowDimensions();
  const [work, setWork] = useState<Work | null>(null);
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [choosingCover, setChoosingCover] = useState(false);

  const load = useCallback(() => {
    const workId = Number(id);
    getWork(db, workId).then(setWork);
    listRecords(db, workId).then(setRecords);
  }, [db, id]);

  useFocusEffect(load);

  function editRecord(record: RecordEntry) {
    if (!work) return;
    router.push({ pathname: '/travel/write', params: { id: work.externalId, recordId: record.id, workId: work.id } });
  }

  function confirmDelete(record: RecordEntry) {
    Alert.alert('이 기록을 지울까요?', '지운 기록은 되돌릴 수 없어요', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const workRemoved = await deleteRecord(db, record.id);
            // The pin comes off the map with its last record
            if (workRemoved) router.back();
            else load();
          } catch {
            Alert.alert('지우지 못했어요', '잠시 후 다시 시도해주세요');
          }
        },
      },
    ]);
  }

  function openRecordMenu(record: RecordEntry) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['수정', '삭제', '취소'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) editRecord(record);
        else if (index === 1) confirmDelete(record);
      },
    );
  }

  // Another trip starts a new record from the saved city
  function visitAgain() {
    if (!work || work.latitude === null || work.longitude === null) return;
    const city: City = {
      externalId: work.externalId,
      name: work.title,
      // The saved subtitle already reads "region · country"; keep it as is
      region: null,
      country: work.subtitle,
      countryCode: work.countryCode,
      latitude: work.latitude,
      longitude: work.longitude,
    };
    router.push({
      pathname: '/travel/write',
      params: { id: work.externalId, city: JSON.stringify(city), from: 'work' },
    });
  }

  async function chooseCover(fileName: string | null) {
    if (!work) return;
    Haptics.selectionAsync();
    setChoosingCover(false);
    await setWorkCover(db, work.id, fileName);
    load();
  }

  // Newest trips first, so recent photos lead the picker
  const allPhotos = [...records].reverse().flatMap((r) => r.photos);
  // The chosen photo, unless its record was deleted; otherwise the latest trip's first photo
  const cover = work?.coverPhoto && allPhotos.includes(work.coverPhoto) ? work.coverPhoto : (allPhotos[0] ?? null);
  const code = work?.countryCode ?? '';
  // The back of the card: the latest trip's remembered scene, else its first line
  const latestNoted = [...records].reverse().find((r) => r.moment || r.body.trim());
  const postcardNote = latestNoted
    ? { text: latestNoted.moment ?? firstLine(latestNoted.body), date: latestNoted.experiencedOn }
    : null;
  const tile = (width - 40 - COVER_GAP * (COVER_COLUMNS - 1)) / COVER_COLUMNS;

  return (
    <View style={styles.container}>
      <MapPaper />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.headerButton}>지도로</Text>
          </Pressable>
        </View>

        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            work && (
              <Animated.View entering={FadeIn.duration(600)} style={styles.top}>
                <Postcard
                  city={work.title}
                  cover={cover}
                  note={postcardNote?.text ?? null}
                  postedOn={postcardNote?.date ?? null}
                  countryCode={code}
                />
                <View style={styles.underCard}>
                  {!!work.subtitle && <Text style={styles.subtitle}>{work.subtitle}</Text>}
                  <View style={styles.cardActions}>
                    <Text style={styles.coverHint}>엽서를 누르면 뒷면을 볼 수 있어요</Text>
                    {allPhotos.length > 0 && (
                      <Pressable onPress={() => setChoosingCover(true)} hitSlop={10}>
                        <Text style={styles.changeCover}>사진 바꾸기</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {records.length > 0 && (
                  <View style={styles.passport}>
                    <Text style={styles.sectionLabel}>입국 도장 · {records.length}번 다녀옴</Text>
                    <View style={styles.stamps}>
                      {records.map((r, i) => (
                        <Stamp key={r.id} code={code} name={work.title} date={r.experiencedOn} index={i} />
                      ))}
                    </View>
                  </View>
                )}
              </Animated.View>
            )
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(200 + index * 120).duration(500)} style={styles.trip}>
              <Pressable onPress={() => editRecord(item)} onLongPress={() => openRecordMenu(item)}>
                <TripTicket
                  transport={asTransport(item.transport)}
                  from={parseOrigin(item.origin)?.name ?? null}
                  to={work?.title ?? ''}
                  toCode={work?.countryCode ?? null}
                  dates={formatTripDates(item.experiencedOn, item.endedOn)}
                  length={tripLength(item.experiencedOn, item.endedOn)}>
                  <Text style={styles.visit}>{index + 1}번째 방문</Text>
                  {!!item.moment && <Text style={styles.moment}>“{item.moment}”</Text>}
                  {!!item.body && <Text style={styles.body}>{item.body}</Text>}
                  {item.photos.length > 0 && <Snapshots photos={item.photos} />}
                </TripTicket>
              </Pressable>
            </Animated.View>
          )}
          ListFooterComponent={
            work && (
              <Pressable onPress={visitAgain} style={styles.again}>
                <Text style={styles.againText}>또 다녀와서 기록하기</Text>
              </Pressable>
            )
          }
        />
      </SafeAreaView>

      {/* Picking the postcard's photo from every trip to this city */}
      <Modal
        visible={choosingCover}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChoosingCover(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>엽서 사진 고르기</Text>
            <Pressable onPress={() => setChoosingCover(false)} hitSlop={12}>
              <Text style={styles.headerButton}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.grid}>
            {allPhotos.map((name) => (
              <Pressable key={name} onPress={() => chooseCover(name)}>
                <Image
                  source={photoUri(name)}
                  style={[{ width: tile, height: tile }, name === cover && styles.chosen]}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
          {!!work?.coverPhoto && (
            <Pressable onPress={() => chooseCover(null)} style={styles.again}>
              <Text style={styles.againText}>자동으로 고르기</Text>
            </Pressable>
          )}
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerButton: {
    fontFamily: LibraryFonts.serif,
    fontSize: 14,
    color: MapColors.inkDim,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  top: {
    gap: 10,
    paddingBottom: 24,
  },
  underCard: {
    marginTop: 6,
    gap: 4,
  },
  subtitle: {
    fontFamily: LibraryFonts.serif,
    fontSize: 13,
    color: MapColors.inkDim,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeCover: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 12,
    color: MapColors.pin,
  },
  coverHint: {
    fontFamily: LibraryFonts.serif,
    fontSize: 11,
    color: MapColors.inkDim,
    opacity: 0.8,
  },
  passport: {
    marginTop: 14,
    gap: 12,
  },
  sectionLabel: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    letterSpacing: 1,
    color: MapColors.inkDim,
  },
  stamps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  stamp: {
    width: 92,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 2,
    borderRadius: 10,
    opacity: 0.85,
  },
  stampCode: {
    fontFamily: CinemaFonts.sign,
    fontSize: 20,
    letterSpacing: 2,
  },
  stampName: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 12,
  },
  stampDate: {
    fontFamily: CinemaFonts.sign,
    fontSize: 12,
    letterSpacing: 1,
  },
  trip: {
    marginBottom: 18,
  },
  visit: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: MapColors.inkDim,
  },
  moment: {
    fontFamily: LibraryFonts.pen,
    fontSize: 24,
    lineHeight: 30,
    color: MapColors.pin,
  },
  body: {
    fontFamily: LibraryFonts.pen,
    fontSize: 22,
    lineHeight: 28,
    color: MapColors.ink,
  },
  again: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: MapColors.coast,
  },
  againText: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 14,
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
    fontSize: 17,
    color: MapColors.ink,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COVER_GAP,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  chosen: {
    borderWidth: 3,
    borderColor: MapColors.pin,
  },
});
