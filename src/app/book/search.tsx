import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaperGrain } from '@/components/library/paper-grain';
import { LibraryColors, LibraryFonts } from '@/components/library/theme';
import { searchBooks, type KakaoBook } from '@/lib/kakao';

const DEBOUNCE_MS = 350;

// Search screen styled like a library card catalogue
export default function BookSearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KakaoBook[]>([]);
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
        setResults(await searchBooks(trimmed, controller.signal));
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
    <View style={styles.container}>
      <PaperGrain />
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>닫기</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="어떤 책을 읽었나요?"
          placeholderTextColor={LibraryColors.inkDim}
          selectionColor={LibraryColors.pencil}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {showLoading && <ActivityIndicator style={styles.status} color={LibraryColors.inkDim} />}
        {showError && <Text style={styles.status}>검색하지 못했어요. 잠시 후 다시 시도해주세요</Text>}
        {showEmpty && <Text style={styles.status}>검색 결과가 없어요</Text>}

        <FlatList
          data={visibleResults}
          keyExtractor={(item, index) => `${item.externalId}-${index}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({ pathname: '/book/write', params: { id: item.externalId, book: JSON.stringify(item) } })
              }>
              {item.coverUrl ? (
                <Image source={item.coverUrl} style={styles.cover} contentFit="cover" />
              ) : (
                <View style={styles.cover} />
              )}
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[item.authors.join(', '), item.publisher, item.publishedDate?.slice(0, 4)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
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
    backgroundColor: LibraryColors.paper,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  back: {
    fontFamily: LibraryFonts.serif,
    fontSize: 14,
    color: LibraryColors.inkDim,
  },
  input: {
    marginHorizontal: 20,
    paddingVertical: 12,
    fontFamily: LibraryFonts.serif,
    fontSize: 18,
    color: LibraryColors.ink,
    borderBottomWidth: 1,
    borderBottomColor: LibraryColors.pencil,
  },
  status: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: LibraryFonts.serif,
    color: LibraryColors.inkDim,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LibraryColors.rule,
  },
  cover: {
    width: 52,
    height: 76,
    backgroundColor: LibraryColors.paperEdge,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  title: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 16,
    color: LibraryColors.ink,
  },
  meta: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: LibraryColors.inkDim,
  },
});
