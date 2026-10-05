import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoxOfficeTicket } from '@/components/cinema/box-office-ticket';
import { MarqueeSign } from '@/components/cinema/marquee-sign';
import { CinemaColors, CinemaFonts } from '@/components/cinema/theme';
import { searchTitles, toExternalId, type TmdbTitle } from '@/lib/tmdb';

const DEBOUNCE_MS = 350;

function openWrite(title: TmdbTitle) {
  router.push({ pathname: '/movie/write', params: { id: toExternalId(title) } });
}

// The box office: type at the ticket window, and results print out as tickets
export default function MovieSearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbTitle[]>([]);
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
        setResults(await searchTitles(trimmed, controller.signal));
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
      </View>

      <MarqueeSign>
        <Text style={styles.marquee}>BOX OFFICE</Text>
      </MarqueeSign>

      {/* Ticket window: the input sits behind the booth's glass */}
      <View style={styles.window}>
        <Text style={styles.windowLabel}>TICKETS</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="어떤 영화나 드라마를 봤나요?"
          placeholderTextColor={CinemaColors.textDim}
          selectionColor={CinemaColors.brass}
          keyboardAppearance="dark"
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      <View style={styles.counter} />

      {showLoading && <ActivityIndicator style={styles.status} color={CinemaColors.textDim} />}
      {showError && <Text style={styles.status}>검색하지 못했어요. 잠시 후 다시 시도해주세요</Text>}
      {showEmpty && <Text style={styles.status}>검색 결과가 없어요</Text>}

      <FlatList
        data={visibleResults}
        keyExtractor={(item) => toExternalId(item)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => <BoxOfficeTicket title={item} onPick={openWrite} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CinemaColors.theater,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  back: {
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    color: CinemaColors.textDim,
  },
  marquee: {
    fontFamily: CinemaFonts.sign,
    fontSize: 30,
    letterSpacing: 3,
    color: CinemaColors.marquee,
    textShadowColor: CinemaColors.marqueeGlow,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  // Arched glass of the booth, framed in brass
  window: {
    marginTop: 18,
    marginHorizontal: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: CinemaColors.plaqueBorder,
    backgroundColor: 'rgba(255, 220, 170, 0.05)',
  },
  windowLabel: {
    alignSelf: 'center',
    fontFamily: CinemaFonts.sign,
    fontSize: 12,
    letterSpacing: 4,
    color: CinemaColors.brassDim,
  },
  input: {
    paddingVertical: 12,
    fontFamily: CinemaFonts.serif,
    fontSize: 18,
    color: CinemaColors.text,
  },
  // Brass ledge under the window where tickets get slid out
  counter: {
    height: 5,
    marginHorizontal: 14,
    borderRadius: 2,
    backgroundColor: CinemaColors.brassDim,
  },
  status: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    color: CinemaColors.textDim,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
  },
});
