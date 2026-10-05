import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StarRating } from '@/components/cinema/star-rating';
import { PaperGrain } from '@/components/library/paper-grain';
import { Polaroids } from '@/components/library/polaroids';
import { LibraryColors, LibraryFonts } from '@/components/library/theme';
import { useDb } from '@/lib/database';
import { deleteRecord, getWork, listRecords, type RecordEntry, type Work } from '@/lib/db';
import type { KakaoBook } from '@/lib/kakao';

// The opened book: each reading is a dated entry with its underlined passages
export default function BookWorkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const [work, setWork] = useState<Work | null>(null);
  const [records, setRecords] = useState<RecordEntry[]>([]);

  const load = useCallback(() => {
    const workId = Number(id);
    getWork(db, workId).then(setWork);
    listRecords(db, workId).then(setRecords);
  }, [db, id]);

  useFocusEffect(load);

  function editRecord(record: RecordEntry) {
    if (!work) return;
    router.push({
      pathname: '/book/write',
      params: { id: work.externalId, recordId: record.id, workId: work.id },
    });
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
            // The book leaves the shelf with its last record
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

  // Re-reading starts a new record from the saved book, in the same shape as a search result
  function rereadRecord() {
    if (!work) return;
    const book: KakaoBook = {
      externalId: work.externalId,
      title: work.title,
      authors: work.subtitle ? work.subtitle.split(', ') : [],
      publisher: '',
      publishedDate: work.releaseDate,
      coverUrl: work.imageUrl,
    };
    router.push({ pathname: '/book/write', params: { id: work.externalId, book: JSON.stringify(book), from: 'work' } });
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <PaperGrain />
      {/* Gutter shadow where the pages meet the spine */}
      <View style={styles.gutter} pointerEvents="none" />

      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.headerButton}>책장으로</Text>
          </Pressable>
        </View>

        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.page}
          ListHeaderComponent={
            work && (
              <Animated.View entering={FadeIn.duration(600)} style={styles.titlePage}>
                {work.imageUrl ? (
                  <Image source={work.imageUrl} style={styles.cover} contentFit="cover" />
                ) : (
                  <View style={styles.cover} />
                )}
                <Text style={styles.title}>{work.title}</Text>
                {!!work.subtitle && <Text style={styles.meta}>{work.subtitle}</Text>}
                {!!work.releaseDate && (
                  <Text style={styles.meta}>출간 {work.releaseDate.replaceAll('-', '.')}</Text>
                )}
              </Animated.View>
            )
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(200 + index * 140).duration(600)}>
              <Pressable
                style={styles.entry}
                onPress={() => editRecord(item)}
                onLongPress={() => openRecordMenu(item)}>
                <View style={styles.entryHead}>
                  <Text style={styles.entryLabel}>{index + 1}번째 독서</Text>
                  <Text style={styles.entryDate}>{item.experiencedOn.replaceAll('-', '.')}</Text>
                </View>
                {item.rating !== null && (
                  <StarRating value={item.rating} size={14} filledColor="#c08a2e" emptyColor={LibraryColors.rule} />
                )}
                {!!item.body && <Text style={styles.body}>{item.body}</Text>}

                {item.quotes.map((q, i) => (
                  <View key={i} style={styles.quote}>
                    <Text style={styles.quoteText}>
                      <Text style={styles.highlight}>{q.quote}</Text>
                    </Text>
                    {!!q.page && <Text style={styles.pageNumber}>p.{q.page}</Text>}
                    {!!q.note && <Text style={styles.note}>→ {q.note}</Text>}
                  </View>
                ))}

                {item.photos.length > 0 && <Polaroids photos={item.photos} />}
              </Pressable>
            </Animated.View>
          )}
          ListFooterComponent={
            work && (
              <Pressable onPress={rereadRecord} style={styles.reread}>
                <Text style={styles.rereadText}>다시 읽고 기록하기</Text>
              </Pressable>
            )
          }
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
  gutter: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 18,
    backgroundColor: 'rgba(90, 60, 30, 0.08)',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerButton: {
    fontFamily: LibraryFonts.serif,
    fontSize: 14,
    color: LibraryColors.inkDim,
  },
  page: {
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  titlePage: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 32,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LibraryColors.rule,
  },
  cover: {
    width: 120,
    height: 174,
    marginBottom: 12,
    backgroundColor: LibraryColors.paperEdge,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 3, height: 4 },
  },
  title: {
    textAlign: 'center',
    fontFamily: LibraryFonts.serifBold,
    fontSize: 20,
    lineHeight: 28,
    color: LibraryColors.ink,
  },
  meta: {
    textAlign: 'center',
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: LibraryColors.inkDim,
  },
  entry: {
    gap: 12,
    paddingVertical: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LibraryColors.rule,
  },
  entryHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  entryLabel: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 13,
    letterSpacing: 1,
    color: LibraryColors.ink,
  },
  entryDate: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: LibraryColors.inkDim,
  },
  body: {
    fontFamily: LibraryFonts.serif,
    fontSize: 15,
    lineHeight: 27,
    color: LibraryColors.ink,
  },
  quote: {
    gap: 6,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: LibraryColors.rule,
  },
  quoteText: {
    fontFamily: LibraryFonts.serif,
    fontSize: 15,
    lineHeight: 28,
    color: LibraryColors.ink,
  },
  // Highlighter pen over the copied passage
  highlight: {
    backgroundColor: LibraryColors.highlight,
  },
  pageNumber: {
    alignSelf: 'flex-end',
    fontFamily: LibraryFonts.serif,
    fontSize: 11,
    color: LibraryColors.inkDim,
  },
  note: {
    fontFamily: LibraryFonts.pen,
    fontSize: 21,
    lineHeight: 26,
    color: LibraryColors.pencil,
  },
  reread: {
    alignSelf: 'center',
    marginTop: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: LibraryColors.pencil,
  },
  rereadText: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 13,
    color: LibraryColors.ink,
  },
});
