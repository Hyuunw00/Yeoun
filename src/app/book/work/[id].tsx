import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StarRating } from '@/components/cinema/star-rating';
import { AgedPaper } from '@/components/library/aged-paper';
import { ExLibris } from '@/components/library/ex-libris';
import { PencilUnderline } from '@/components/library/pencil-underline';
import { Polaroids } from '@/components/library/polaroids';
import { LibraryColors, LibraryFonts } from '@/components/library/theme';
import { useDb } from '@/lib/database';
import { deleteRecord, getWork, listRecords, type RecordEntry, type Work } from '@/lib/db';
import type { KakaoBook } from '@/lib/kakao';

// Readings rated this high get a dog-eared page
const DOG_EAR_RATING = 4.5;
// Ideographic space: the first-line indent of Korean book typesetting
const INDENT = '　';

const formatDate = (date: string) => date.replaceAll('-', '.');

// Body set like a printed page: a raised initial, then indented paragraphs
function Prose({ text }: { text: string }) {
  const [first, ...rest] = Array.from(text);
  const paragraphs = rest.join('').split('\n');
  return (
    <Text style={styles.prose}>
      <Text style={styles.initial}>{first}</Text>
      {paragraphs.map((p, i) => (i === 0 ? p : `\n${INDENT}${p}`)).join('')}
    </Text>
  );
}

// The opened book: each reading is a chapter, rereads are printings in the colophon
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
      <AgedPaper />
      {/* Gutter shadow where the pages meet the spine */}
      <View style={styles.gutter} pointerEvents="none" />

      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Text style={styles.headerButton}>책장으로</Text>
          </Pressable>
          {/* Running head: the book's title, small and centered like at the top of a page */}
          <Text style={styles.runningHead} numberOfLines={1}>
            {work?.title}
          </Text>
        </View>

        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.page}
          ListHeaderComponent={
            work && (
              <Animated.View entering={FadeIn.duration(600)} style={styles.titlePage}>
                <View>
                  {work.imageUrl ? (
                    <Image source={work.imageUrl} style={styles.cover} contentFit="cover" />
                  ) : (
                    <View style={styles.cover} />
                  )}
                  <View style={styles.stamp}>
                    <ExLibris />
                  </View>
                </View>
                <Text style={styles.title}>{work.title}</Text>
                {!!work.subtitle && <Text style={styles.meta}>{work.subtitle}</Text>}
              </Animated.View>
            )
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(200 + index * 140).duration(600)}>
              <Pressable
                style={styles.chapter}
                onPress={() => editRecord(item)}
                onLongPress={() => openRecordMenu(item)}>
                {item.rating !== null && item.rating >= DOG_EAR_RATING && <View style={styles.dogEar} />}

                <View style={styles.opener}>
                  <Text style={styles.chapterNumber}>제{index + 1}장</Text>
                  <Text style={styles.ornament}>❦</Text>
                  <Text style={styles.chapterDate}>{formatDate(item.experiencedOn)}</Text>
                  {item.rating !== null && (
                    <StarRating value={item.rating} size={13} filledColor="#b5822c" emptyColor={LibraryColors.rule} />
                  )}
                </View>

                {!!item.body && <Prose text={item.body} />}

                {item.quotes.map((q, i) => (
                  <View key={i} style={styles.quote}>
                    <PencilUnderline style={styles.quoteText}>{q.quote}</PencilUnderline>
                    {!!q.page && <Text style={styles.quotePage}>p.{q.page}</Text>}
                    {!!q.note && (
                      <Text style={[styles.marginNote, { transform: [{ rotate: i % 2 ? '1deg' : '-1.5deg' }] }]}>
                        ↳ {q.note}
                      </Text>
                    )}
                  </View>
                ))}

                {item.photos.length > 0 && <Polaroids photos={item.photos} />}

                <Text style={styles.folio}>— {index + 1} —</Text>
              </Pressable>
            </Animated.View>
          )}
          ListFooterComponent={
            work && (
              <View>
                {/* Colophon: every reread is another printing */}
                <View style={styles.colophon}>
                  <Text style={styles.colophonTitle}>{work.title}</Text>
                  {!!work.subtitle && <Text style={styles.colophonLine}>지은이  {work.subtitle}</Text>}
                  {!!work.releaseDate && (
                    <Text style={styles.colophonLine}>펴낸 날  {formatDate(work.releaseDate)}</Text>
                  )}
                  <View style={styles.colophonRule} />
                  {records.map((record, i) => (
                    <Text key={record.id} style={styles.colophonLine}>
                      {i + 1}쇄  {formatDate(record.experiencedOn)}
                    </Text>
                  ))}
                  <View style={styles.colophonRule} />
                  <Text style={styles.colophonLine}>여운의 서재</Text>
                </View>

                <Pressable onPress={rereadRecord} style={styles.reread}>
                  <Text style={styles.rereadText}>다시 읽고 기록하기</Text>
                </Pressable>
              </View>
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
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  back: {
    position: 'absolute',
    left: 24,
    zIndex: 1,
  },
  headerButton: {
    fontFamily: LibraryFonts.serif,
    fontSize: 13,
    color: LibraryColors.inkDim,
  },
  runningHead: {
    marginHorizontal: 72,
    textAlign: 'center',
    fontFamily: LibraryFonts.serif,
    fontSize: 11,
    letterSpacing: 2,
    color: LibraryColors.inkDim,
  },
  page: {
    paddingHorizontal: 34,
    paddingBottom: 80,
  },
  titlePage: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 40,
  },
  cover: {
    width: 120,
    height: 174,
    marginBottom: 14,
    backgroundColor: LibraryColors.paperEdge,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 3, height: 4 },
  },
  stamp: {
    position: 'absolute',
    right: -46,
    bottom: -4,
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
  chapter: {
    gap: 18,
    paddingTop: 36,
    paddingBottom: 20,
  },
  dogEar: {
    position: 'absolute',
    top: 0,
    right: -34,
    width: 0,
    height: 0,
    borderTopWidth: 28,
    borderLeftWidth: 28,
    borderTopColor: LibraryColors.paper,
    borderLeftColor: LibraryColors.paperEdge,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: -1, height: 1 },
  },
  opener: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  chapterNumber: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 15,
    letterSpacing: 4,
    color: LibraryColors.ink,
  },
  ornament: {
    fontSize: 16,
    color: LibraryColors.pencil,
  },
  chapterDate: {
    fontFamily: LibraryFonts.serif,
    fontSize: 11,
    letterSpacing: 1,
    color: LibraryColors.inkDim,
  },
  prose: {
    textAlign: 'justify',
    fontFamily: LibraryFonts.serif,
    fontSize: 15,
    lineHeight: 28,
    color: LibraryColors.ink,
  },
  // Raised initial: the first character set larger than the body
  initial: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 30,
  },
  quote: {
    gap: 4,
  },
  quoteText: {
    fontFamily: LibraryFonts.serif,
    fontSize: 15,
    lineHeight: 30,
    color: LibraryColors.ink,
  },
  quotePage: {
    alignSelf: 'flex-end',
    fontFamily: LibraryFonts.serif,
    fontSize: 11,
    color: LibraryColors.inkDim,
  },
  // My thought written in the margin by hand
  marginNote: {
    marginLeft: 16,
    fontFamily: LibraryFonts.pen,
    fontSize: 21,
    lineHeight: 25,
    color: LibraryColors.pencil,
  },
  folio: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: LibraryFonts.serif,
    fontSize: 11,
    color: LibraryColors.inkDim,
  },
  colophon: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 48,
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: LibraryColors.inkDim,
  },
  colophonTitle: {
    marginBottom: 4,
    fontFamily: LibraryFonts.serifBold,
    fontSize: 13,
    color: LibraryColors.ink,
  },
  colophonLine: {
    fontFamily: LibraryFonts.serif,
    fontSize: 11,
    color: LibraryColors.inkDim,
  },
  colophonRule: {
    width: 40,
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
    backgroundColor: LibraryColors.inkDim,
  },
  reread: {
    alignSelf: 'center',
    marginTop: 32,
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
