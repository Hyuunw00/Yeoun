import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CinemaColors, CinemaFonts } from '@/components/cinema/theme';
import { posterUrl, searchTitles, toExternalId, type TmdbTitle } from '@/lib/tmdb';

const DEBOUNCE_MS = 350;

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

      {showLoading && <ActivityIndicator style={styles.status} color={CinemaColors.textDim} />}
      {showError && <Text style={styles.status}>검색하지 못했어요. 잠시 후 다시 시도해주세요</Text>}
      {showEmpty && <Text style={styles.status}>검색 결과가 없어요</Text>}

      <FlatList
        data={visibleResults}
        keyExtractor={(item) => toExternalId(item)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push({ pathname: '/movie/write', params: { id: toExternalId(item) } })}>
            {item.posterPath ? (
              <Image source={posterUrl(item.posterPath)} style={styles.poster} contentFit="cover" />
            ) : (
              <View style={[styles.poster, styles.posterEmpty]} />
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[item.mediaType === 'tv' && '드라마', item.releaseDate?.slice(0, 4), item.originalTitle !== item.title && item.originalTitle]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </Pressable>
        )}
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
    paddingVertical: 12,
  },
  back: {
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    color: CinemaColors.textDim,
  },
  input: {
    marginHorizontal: 20,
    paddingVertical: 12,
    fontFamily: CinemaFonts.serif,
    fontSize: 18,
    color: CinemaColors.text,
    borderBottomWidth: 1,
    borderBottomColor: CinemaColors.plaqueBorder,
  },
  status: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    color: CinemaColors.textDim,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  poster: {
    width: 52,
    height: 78,
    backgroundColor: '#111',
  },
  posterEmpty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CinemaColors.hairline,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  title: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 16,
    color: CinemaColors.text,
  },
  meta: {
    fontFamily: CinemaFonts.serif,
    fontSize: 12,
    color: CinemaColors.textDim,
  },
});
