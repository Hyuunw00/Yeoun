import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CinemaFonts } from '@/components/cinema/theme';
import { PaperGrain } from '@/components/library/paper-grain';
import { LibraryFonts } from '@/components/library/theme';
import { MapColors } from '@/components/travel/theme';
import { useDb } from '@/lib/database';
import { countTripsWithoutOrigin, fillMissingOrigins } from '@/lib/db';
import { saveHome } from '@/lib/home';
import { resolveCity, suggestCities, type CitySuggestion } from '@/lib/places';

const DEBOUNCE_MS = 250;

// The ticket office: name a destination and pick it from the timetable.
// With `mode=home` the picked city becomes home, where trips leave from.
export default function TravelSearchScreen() {
  const { mode } = useLocalSearchParams<{ mode?: 'home' }>();
  const isHome = mode === 'home';
  const db = useDb();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // The picked row while the iOS geocoder confirms it
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        setResults(await suggestCities(trimmed, controller.signal));
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function pick(suggestion: CitySuggestion) {
    if (resolving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResolving(suggestion.id);
    try {
      const city = await resolveCity(suggestion);
      if (!city) {
        Alert.alert('도시를 확인하지 못했어요', '다른 이름으로 검색해보세요');
        return;
      }
      if (isHome) {
        const { name, countryCode, latitude, longitude } = city;
        const home = { name, countryCode, latitude, longitude };
        await saveHome(home);
        const missing = await countTripsWithoutOrigin(db);
        if (missing === 0) {
          router.back();
          return;
        }
        // Earlier trips without a starting point can take this home as theirs, once
        Alert.alert(
          `출발지가 없는 여행 ${missing}개에도 ${name}을(를) 넣을까요?`,
          '지도에 출발지에서 가는 길이 그려져요',
          [
            { text: '아니요', style: 'cancel', onPress: () => router.back() },
            {
              text: '넣기',
              onPress: async () => {
                try {
                  await fillMissingOrigins(db, JSON.stringify(home));
                } catch {
                  Alert.alert('출발지를 넣지 못했어요', '잠시 후 다시 시도해주세요');
                }
                router.back();
              },
            },
          ],
        );
        return;
      }
      router.push({ pathname: '/travel/write', params: { id: city.externalId, city: JSON.stringify(city) } });
    } catch {
      Alert.alert('도시를 확인하지 못했어요', '잠시 후 다시 시도해주세요');
    } finally {
      setResolving(null);
    }
  }

  const hasQuery = query.trim() !== '';
  const visibleResults = hasQuery ? results : [];
  const showLoading = hasQuery && loading && results.length === 0;
  const showError = hasQuery && !loading && error;
  const showEmpty = hasQuery && !loading && !error && results.length === 0;

  return (
    <View style={styles.container}>
      <PaperGrain opacity={0.14} />
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>닫기</Text>
          </Pressable>
        </View>

        {/* Ticket office window: the destination is written on the order slip */}
        <View style={styles.slip}>
          <Text style={styles.office}>{isHome ? 'HOME · 사는 곳' : 'TICKET OFFICE · 매표소'}</Text>
          <Text style={styles.question}>{isHome ? '지금 어디에 살고 있나요?' : '어디로 떠났나요?'}</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="도시 이름"
            placeholderTextColor={MapColors.inkDim}
            selectionColor={MapColors.pin}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {showLoading && <ActivityIndicator style={styles.status} color={MapColors.inkDim} />}
        {showError && <Text style={styles.status}>검색하지 못했어요. 잠시 후 다시 시도해주세요</Text>}
        {showEmpty && <Text style={styles.status}>검색 결과가 없어요</Text>}

        <FlatList
          data={visibleResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => pick(item)} disabled={!!resolving}>
              <View style={styles.rowMain}>
                <Text style={styles.city}>{item.name}</Text>
                <Text style={styles.region} numberOfLines={1}>
                  {[item.region, item.country].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {resolving === item.id ? (
                <ActivityIndicator color={MapColors.pin} />
              ) : (
                <View style={styles.stamp}>
                  <Text style={styles.stampText}>{item.countryCode ?? '—'}</Text>
                </View>
              )}
            </Pressable>
          )}
        />
      </SafeAreaView>
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
    paddingVertical: 8,
  },
  back: {
    fontFamily: LibraryFonts.serif,
    fontSize: 14,
    color: MapColors.inkDim,
  },
  slip: {
    marginHorizontal: 16,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 4,
    backgroundColor: MapColors.paper,
    borderWidth: 1.5,
    borderColor: MapColors.coast,
    shadowColor: '#3b2c1e',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  office: {
    fontFamily: CinemaFonts.sign,
    fontSize: 12,
    letterSpacing: 3,
    color: MapColors.inkDim,
  },
  question: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 20,
    color: MapColors.ink,
  },
  input: {
    paddingVertical: 10,
    fontFamily: LibraryFonts.serif,
    fontSize: 17,
    color: MapColors.ink,
  },
  status: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: LibraryFonts.serif,
    color: MapColors.inkDim,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MapColors.coast,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  city: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 18,
    color: MapColors.ink,
  },
  region: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: MapColors.inkDim,
  },
  // Country code in a round rubber stamp
  stamp: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: MapColors.pin,
    opacity: 0.85,
    transform: [{ rotate: '-10deg' }],
  },
  stampText: {
    fontFamily: CinemaFonts.sign,
    fontSize: 16,
    letterSpacing: 1,
    color: MapColors.pin,
  },
});
