import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CinemaFonts } from '@/components/cinema/theme';
import { BinSleeve } from '@/components/record-shop/bin-sleeve';
import { RecordColors } from '@/components/record-shop/theme';
import { searchMusic, type MusicFilter, type MusicResult } from '@/lib/itunes';

const DEBOUNCE_MS = 350;
const GUTTER = 20;
const COLUMN_GAP = 16;
// Divider cards that split the bin, like the ones in a record shop crate
const DIVIDERS: { filter: MusicFilter; label: string }[] = [
  { filter: 'all', label: '전체' },
  { filter: 'album', label: '앨범' },
  { filter: 'song', label: '곡' },
];

function openWrite(item: MusicResult) {
  router.push({ pathname: '/music/write', params: { id: item.externalId, music: JSON.stringify(item) } });
}

// Digging through the shop's bins: results come out as sleeves filed behind divider cards
export default function MusicSearchScreen() {
  const { width } = useWindowDimensions();
  const cellSize = (width - GUTTER * 2 - COLUMN_GAP) / 2;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MusicFilter>('all');
  const [results, setResults] = useState<MusicResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        setResults(await searchMusic(trimmed, filter, controller.signal));
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
  }, [query, filter]);

  const hasQuery = query.trim() !== '';
  const visibleResults = hasQuery ? results : [];
  const showLoading = hasQuery && loading;
  const showError = hasQuery && !loading && error;
  const showEmpty = hasQuery && !loading && !error && results.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>닫기</Text>
        </Pressable>
        <Text style={styles.sign}>DIGGING</Text>
        <View style={styles.headerSpacer} />
      </View>

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="어떤 음악을 들었나요? 앨범이나 노래 제목"
        placeholderTextColor={RecordColors.textDim}
        selectionColor={RecordColors.neon}
        keyboardAppearance="dark"
        autoFocus
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <View style={styles.dividers}>
        {DIVIDERS.map((d) => {
          const active = d.filter === filter;
          return (
            <Pressable
              key={d.filter}
              onPress={() => {
                if (active) return;
                Haptics.selectionAsync();
                // Don't show the other bin's records while this one loads
                setResults([]);
                setFilter(d.filter);
              }}
              style={[styles.divider, active && styles.dividerActive]}>
              <Text style={[styles.dividerText, active && styles.dividerTextActive]}>{d.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.binEdge} />

      {showLoading && <ActivityIndicator style={styles.status} color={RecordColors.textDim} />}
      {showError && <Text style={styles.status}>검색하지 못했어요. 잠시 후 다시 시도해주세요</Text>}
      {showEmpty && <Text style={styles.status}>검색 결과가 없어요</Text>}

      <FlatList
        data={visibleResults}
        keyExtractor={(item, index) => `${item.externalId}-${item.trackName ?? ''}-${index}`}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.grid}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => <BinSleeve item={item} size={cellSize} onPick={openWrite} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RecordColors.wall,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingVertical: 8,
  },
  back: {
    width: 40,
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    color: RecordColors.textDim,
  },
  headerSpacer: {
    width: 40,
  },
  sign: {
    fontFamily: CinemaFonts.sign,
    fontSize: 26,
    letterSpacing: 6,
    color: RecordColors.neon,
    textShadowColor: RecordColors.neonGlow,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  input: {
    marginHorizontal: GUTTER,
    paddingVertical: 12,
    fontFamily: CinemaFonts.serif,
    fontSize: 17,
    color: RecordColors.text,
    borderBottomWidth: 1,
    borderBottomColor: RecordColors.hairline,
  },
  dividers: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 18,
    paddingHorizontal: GUTTER,
  },
  // Cardboard divider tab sticking up out of the bin
  divider: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 5,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: RecordColors.crateDark,
  },
  dividerActive: {
    paddingTop: 10,
    backgroundColor: RecordColors.paper,
  },
  dividerText: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 13,
    color: RecordColors.textDim,
  },
  dividerTextActive: {
    color: RecordColors.ink,
  },
  // Front lip of the wooden bin the dividers stand in
  binEdge: {
    height: 6,
    marginHorizontal: GUTTER - 6,
    borderRadius: 2,
    backgroundColor: RecordColors.crateEdge,
  },
  status: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    color: RecordColors.textDim,
  },
  grid: {
    paddingHorizontal: GUTTER,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 28,
  },
  column: {
    gap: COLUMN_GAP,
  },
});
