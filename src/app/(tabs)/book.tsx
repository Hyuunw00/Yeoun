import * as Haptics from 'expo-haptics';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShelfBook } from '@/components/library/shelf-book';
import { StudyBackdrop } from '@/components/library/study-backdrop';
import { LibraryColors, LibraryFonts } from '@/components/library/theme';
import { useDb } from '@/lib/database';
import { deleteWork, listWorks, type WorkSummary } from '@/lib/db';

const COLUMNS = 3;
const SIDE_PADDING = 20;
const BOOK_GAP = 18;
const SEARCH_DEBOUNCE_MS = 200;

export default function LibraryScreen() {
  const db = useDb();
  const { width } = useWindowDimensions();
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const bookWidth = (width - SIDE_PADDING * 2 - BOOK_GAP * (COLUMNS - 1)) / COLUMNS;

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const loadWorks = useCallback(() => {
    listWorks(db, 'book', searchQuery).then(setWorks);
  }, [db, searchQuery]);

  useFocusEffect(loadWorks);

  function closeSearch() {
    setSearchOpen(false);
    setQuery('');
  }

  function openBook(work: WorkSummary) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/book/work/[id]', params: { id: work.id } });
  }

  function openBookMenu(work: WorkSummary) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ActionSheetIOS.showActionSheetWithOptions(
      { title: work.title, options: ['책장에서 빼기', '취소'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
      (index) => {
        if (index !== 0) return;
        Alert.alert('책장에서 뺄까요?', '이 책의 기록이 모두 지워지고 되돌릴 수 없어요', [
          { text: '취소', style: 'cancel' },
          {
            text: '빼기',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteWork(db, work.id);
                loadWorks();
              } catch {
                Alert.alert('빼지 못했어요', '잠시 후 다시 시도해주세요');
              }
            },
          },
        ]);
      },
    );
  }

  return (
    <View style={styles.container}>
      <StudyBackdrop />

      <SafeAreaView style={styles.flex} edges={['top']}>
        <FlatList
          data={works}
          keyExtractor={(item) => String(item.id)}
          numColumns={COLUMNS}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.shelf}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.plate}>
                <Text style={styles.plateSub}>YEOUN LIBRARY</Text>
                <Text style={styles.plateTitle}>서재</Text>
              </View>
              <View style={styles.headerRow}>
                <Text style={styles.count}>꽂힌 책 {works.length}권</Text>
                <View style={styles.actions}>
                  {!searchOpen && (
                    <Pressable onPress={() => setSearchOpen(true)} hitSlop={8}>
                      <Text style={styles.action}>찾기</Text>
                    </Pressable>
                  )}
                  <Link href="/book/search" style={styles.add}>
                    기록하기
                  </Link>
                </View>
              </View>
              {searchOpen && (
                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="제목, 감상, 밑줄 문장으로 찾기"
                    placeholderTextColor={LibraryColors.brassDim}
                    selectionColor={LibraryColors.brass}
                    keyboardAppearance="dark"
                    returnKeyType="search"
                    autoFocus
                  />
                  <Pressable onPress={closeSearch} hitSlop={8}>
                    <Text style={styles.action}>닫기</Text>
                  </Pressable>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searchQuery.trim() ? `'${searchQuery.trim()}'에 맞는 책이 없어요` : '아직 꽂힌 책이 없어요'}
            </Text>
          }
          renderItem={({ item }) => (
            <ShelfBook
              work={item}
              width={bookWidth}
              onPress={() => openBook(item)}
              onLongPress={() => openBookMenu(item)}
            />
          )}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LibraryColors.wall,
  },
  flex: {
    flex: 1,
  },
  list: {
    paddingHorizontal: SIDE_PADDING,
    paddingBottom: 40,
  },
  // Each row of books stands on a wooden shelf board
  shelf: {
    gap: BOOK_GAP,
    alignItems: 'flex-end',
    paddingTop: 22,
    marginHorizontal: -SIDE_PADDING,
    paddingHorizontal: SIDE_PADDING,
    marginBottom: 14,
    borderBottomWidth: 12,
    borderBottomColor: LibraryColors.shelf,
    shadowColor: LibraryColors.shelfShadow,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 8 },
  },
  header: {
    paddingTop: 16,
    gap: 18,
  },
  plate: {
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: LibraryColors.plate,
    borderWidth: 1,
    borderColor: LibraryColors.brassDim,
  },
  plateSub: {
    fontFamily: LibraryFonts.serif,
    fontSize: 10,
    letterSpacing: 4,
    color: LibraryColors.brassDim,
  },
  plateTitle: {
    marginTop: 4,
    fontFamily: LibraryFonts.serifBold,
    fontSize: 26,
    letterSpacing: 8,
    color: LibraryColors.brass,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  count: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: LibraryColors.brassDim,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  action: {
    fontFamily: LibraryFonts.serif,
    fontSize: 13,
    color: LibraryColors.brassDim,
  },
  add: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: LibraryColors.brass,
    fontFamily: LibraryFonts.serifBold,
    fontSize: 13,
    color: LibraryColors.brass,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontFamily: LibraryFonts.serif,
    fontSize: 15,
    color: LibraryColors.paper,
    borderBottomWidth: 1,
    borderBottomColor: LibraryColors.brassDim,
  },
  empty: {
    marginTop: 120,
    textAlign: 'center',
    fontFamily: LibraryFonts.serif,
    color: LibraryColors.brassDim,
  },
});
