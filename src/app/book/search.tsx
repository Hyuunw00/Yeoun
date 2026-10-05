import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogCard } from '@/components/library/catalog-card';
import { LibraryColors, LibraryFonts } from '@/components/library/theme';
import { searchBooks, type KakaoBook } from '@/lib/kakao';

const DEBOUNCE_MS = 350;

function openWrite(book: KakaoBook) {
  router.push({ pathname: '/book/write', params: { id: book.externalId, book: JSON.stringify(book) } });
}

// The library's card catalogue: the query goes on the drawer's label, and results
// come out as catalogue cards filed in the drawer
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>닫기</Text>
        </Pressable>
      </View>

      {/* Drawer front with a brass label holder; the input is the label card */}
      <View style={styles.drawer}>
        <View style={styles.labelHolder}>
          <Text style={styles.labelCaption}>CATALOGUE · 도서 목록</Text>
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
        </View>
        <View style={styles.pull} />
      </View>

      {showLoading && <ActivityIndicator style={styles.status} color={LibraryColors.brassDim} />}
      {showError && <Text style={styles.status}>검색하지 못했어요. 잠시 후 다시 시도해주세요</Text>}
      {showEmpty && <Text style={styles.status}>검색 결과가 없어요</Text>}

      <FlatList
        data={visibleResults}
        keyExtractor={(item, index) => `${item.externalId}-${index}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => <CatalogCard book={item} onPick={openWrite} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LibraryColors.wall,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  back: {
    fontFamily: LibraryFonts.serif,
    fontSize: 14,
    color: LibraryColors.brassDim,
  },
  drawer: {
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 4,
    backgroundColor: LibraryColors.shelf,
    borderWidth: 1,
    borderColor: LibraryColors.shelfEdge,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  labelHolder: {
    alignSelf: 'stretch',
    paddingTop: 8,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: LibraryColors.brass,
    borderRadius: 2,
    backgroundColor: LibraryColors.paper,
  },
  labelCaption: {
    fontFamily: LibraryFonts.serif,
    fontSize: 10,
    letterSpacing: 2,
    color: LibraryColors.inkDim,
  },
  input: {
    paddingVertical: 8,
    fontFamily: LibraryFonts.serif,
    fontSize: 18,
    color: LibraryColors.ink,
  },
  // Brass cup handle of the drawer
  pull: {
    width: 64,
    height: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: LibraryColors.brass,
  },
  status: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: LibraryFonts.serif,
    color: LibraryColors.brassDim,
  },
  list: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 12,
  },
});
