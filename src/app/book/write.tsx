import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StarRating } from '@/components/cinema/star-rating';
import { PaperGrain } from '@/components/library/paper-grain';
import { LibraryColors, LibraryFonts } from '@/components/library/theme';
import { AutoGrowInput } from '@/components/auto-grow-input';
import { PhotoPickerRow } from '@/components/photo-picker-row';
import { toDateString } from '@/lib/date';
import type { Quote } from '@/lib/db';
import type { KakaoBook } from '@/lib/kakao';
import { useRecordEditor } from '@/lib/use-record-editor';

const EMPTY_QUOTE: Quote = { quote: '', page: null, note: null };

export default function BookWriteScreen() {
  // `id` is the book's external id (ISBN); `book` carries the search result for a new record.
  // `recordId` + `workId` switch the screen to editing an existing record.
  const { id, book: bookParam, from, recordId, workId } = useLocalSearchParams<{
    id: string;
    book?: string;
    from?: 'work';
    recordId?: string;
    workId?: string;
  }>();

  // A malformed param (e.g. from a deep link) shows an error instead of crashing the render
  const book = useMemo(() => {
    if (!bookParam) return null;
    try {
      const parsed = JSON.parse(bookParam) as Partial<KakaoBook>;
      if (!parsed.title) return null;
      return { ...parsed, authors: parsed.authors ?? [] } as KakaoBook;
    } catch {
      return null;
    }
  }, [bookParam]);

  const editor = useRecordEditor({
    category: 'book',
    externalId: id,
    recordId,
    workId,
    withQuotes: true,
    newWork: book && {
      category: 'book',
      // Same key as the draft, so a draft always belongs to the work it saves into
      externalId: id,
      title: book.title,
      subtitle: book.authors.join(', ') || null,
      year: book.publishedDate?.slice(0, 4) || null,
      releaseDate: book.publishedDate,
      imageUrl: book.coverUrl,
    },
    onSaved: (isEdit) => {
      // Back to the book when editing or re-recording, otherwise to the shelf
      if (isEdit || from === 'work') router.back();
      else router.dismissTo('/book');
    },
    onWorkRemoved: () => router.dismissTo('/book'),
  });
  const { isEdit, savedWork, quotes, setQuotes, saving, canSave } = editor;

  const header = isEdit
    ? savedWork && {
        title: savedWork.title,
        coverUri: savedWork.imageUrl,
        byline: savedWork.subtitle,
        publishedDate: savedWork.releaseDate,
      }
    : book && {
        title: book.title,
        coverUri: book.coverUrl,
        byline: [book.authors.join(', '), book.publisher].filter(Boolean).join(' · '),
        publishedDate: book.publishedDate,
      };

  function updateQuote(index: number, patch: Partial<Quote>) {
    setQuotes((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <PaperGrain />
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.headerButton}>뒤로</Text>
            </Pressable>
            <View style={styles.headerActions}>
              {isEdit && (
                <Pressable onPress={editor.confirmDelete} disabled={saving} hitSlop={12}>
                  <Text style={styles.headerButton}>삭제</Text>
                </Pressable>
              )}
              <Pressable onPress={editor.save} disabled={!canSave} hitSlop={12}>
                {saving ? (
                  <ActivityIndicator color={LibraryColors.ink} />
                ) : (
                  <Text style={[styles.save, !canSave && styles.disabled]}>남기기</Text>
                )}
              </Pressable>
            </View>
          </View>

          {!header ? (
            editor.recordError || (!isEdit && !book) ? (
              <Text style={styles.status}>{isEdit ? '기록을 불러오지 못했어요' : '책 정보를 불러오지 못했어요'}</Text>
            ) : (
              <ActivityIndicator style={styles.status} color={LibraryColors.inkDim} />
            )
          ) : (
            <ScrollView contentContainerStyle={styles.page} keyboardDismissMode="interactive">
              <View style={styles.book}>
                {header.coverUri ? (
                  <Image source={header.coverUri} style={styles.cover} contentFit="cover" />
                ) : (
                  <View style={styles.cover} />
                )}
                <View style={styles.bookInfo}>
                  <Text style={styles.title} numberOfLines={3}>
                    {header.title}
                  </Text>
                  {!!header.byline && <Text style={styles.meta}>{header.byline}</Text>}
                  {!!header.publishedDate && (
                    <Text style={styles.meta}>출간 {header.publishedDate.replaceAll('-', '.')}</Text>
                  )}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>다 읽은 날</Text>
                <DateTimePicker
                  value={editor.pickerDate}
                  mode="date"
                  display="compact"
                  locale="ko-KR"
                  themeVariant="light"
                  accentColor={LibraryColors.pencil}
                  maximumDate={new Date()}
                  onChange={(_, date) => date && editor.setExperiencedOn(toDateString(date))}
                />
              </View>

              <View style={styles.field}>
                <StarRating
                  value={editor.rating}
                  onChange={editor.setRating}
                  filledColor="#c08a2e"
                  emptyColor={LibraryColors.rule}
                />
                <Text style={styles.meta}>{editor.rating !== null ? editor.rating.toFixed(1) : '별점 (선택)'}</Text>
              </View>

              <PhotoPickerRow
                photos={editor.photos}
                picking={editor.picking}
                progress={editor.pickProgress}
                onAdd={editor.addPhotos}
                onRemove={editor.removePhoto}
                fontFamily={LibraryFonts.serif}
                colors={{
                  border: LibraryColors.pencil,
                  text: LibraryColors.inkDim,
                  badge: LibraryColors.paper,
                  badgeText: LibraryColors.ink,
                }}
              />

              <Text style={styles.section}>감상</Text>
              <AutoGrowInput
                style={styles.body}
                minHeight={140}
                value={editor.body}
                onChangeText={editor.setBody}
                placeholder="AI의 도움 없이, 책을 덮은 지금의 생각을 그대로 적어보세요"
                placeholderTextColor={LibraryColors.inkDim}
                selectionColor={LibraryColors.pencil}
              />

              <Text style={styles.section}>밑줄</Text>
              {quotes.map((q, index) => (
                <View key={index} style={styles.quoteCard}>
                  <Pressable
                    style={styles.quoteRemove}
                    hitSlop={10}
                    onPress={() => setQuotes((prev) => prev.filter((_, i) => i !== index))}>
                    <Text style={styles.quoteRemoveText}>✕</Text>
                  </Pressable>
                  <AutoGrowInput
                    style={styles.quoteText}
                    minHeight={26}
                    value={q.quote}
                    onChangeText={(quote) => updateQuote(index, { quote })}
                    placeholder="마음에 남은 문장을 옮겨 적어보세요"
                    placeholderTextColor={LibraryColors.inkDim}
                    selectionColor={LibraryColors.pencil}
                  />
                  <View style={styles.pageRow}>
                    <Text style={styles.pageLabel}>p.</Text>
                    <TextInput
                      style={styles.pageInput}
                      value={q.page ?? ''}
                      onChangeText={(page) => updateQuote(index, { page })}
                      placeholder="쪽수 (선택)"
                      placeholderTextColor={LibraryColors.inkDim}
                      keyboardType="number-pad"
                    />
                  </View>
                  <AutoGrowInput
                    style={styles.noteText}
                    minHeight={26}
                    value={q.note ?? ''}
                    onChangeText={(note) => updateQuote(index, { note })}
                    placeholder="이 문장에 대한 내 생각 (선택)"
                    placeholderTextColor={LibraryColors.inkDim}
                    selectionColor={LibraryColors.pencil}
                  />
                </View>
              ))}
              <Pressable style={styles.addQuote} onPress={() => setQuotes((prev) => [...prev, EMPTY_QUOTE])}>
                <Text style={styles.addQuoteText}>+ 밑줄 추가</Text>
              </Pressable>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  headerButton: {
    fontFamily: LibraryFonts.serif,
    fontSize: 14,
    color: LibraryColors.inkDim,
  },
  save: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 15,
    color: LibraryColors.ink,
  },
  disabled: {
    opacity: 0.3,
  },
  status: {
    marginVertical: 24,
    textAlign: 'center',
    fontFamily: LibraryFonts.serif,
    color: LibraryColors.inkDim,
  },
  page: {
    paddingHorizontal: 24,
    paddingBottom: 80,
    gap: 18,
  },
  book: {
    flexDirection: 'row',
    gap: 16,
  },
  cover: {
    width: 76,
    height: 110,
    backgroundColor: LibraryColors.paperEdge,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 2, height: 2 },
  },
  bookInfo: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: LibraryFonts.serifBold,
    fontSize: 18,
    lineHeight: 26,
    color: LibraryColors.ink,
  },
  meta: {
    fontFamily: LibraryFonts.serif,
    fontSize: 12,
    color: LibraryColors.inkDim,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontFamily: LibraryFonts.serif,
    fontSize: 13,
    color: LibraryColors.inkDim,
  },
  section: {
    marginTop: 8,
    paddingBottom: 6,
    fontFamily: LibraryFonts.serifBold,
    fontSize: 14,
    letterSpacing: 2,
    color: LibraryColors.ink,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LibraryColors.rule,
  },
  // Multiline inputs need an explicit lineHeight so AutoGrowInput can size them exactly
  body: {
    fontFamily: LibraryFonts.serif,
    fontSize: 16,
    lineHeight: 26,
    color: LibraryColors.ink,
    textAlignVertical: 'top',
  },
  quoteCard: {
    gap: 8,
    paddingLeft: 14,
    paddingRight: 24,
    borderLeftWidth: 3,
    borderLeftColor: LibraryColors.highlight,
  },
  quoteRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  quoteRemoveText: {
    fontSize: 12,
    color: LibraryColors.inkDim,
  },
  quoteText: {
    fontFamily: LibraryFonts.serif,
    fontSize: 15,
    lineHeight: 24,
    color: LibraryColors.ink,
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageLabel: {
    fontFamily: LibraryFonts.serif,
    fontSize: 13,
    color: LibraryColors.inkDim,
  },
  // Fixed height with no vertical padding: single-line inputs center their text,
  // which keeps the placeholder on the same line as the label next to it
  pageInput: {
    minWidth: 90,
    height: 26,
    paddingVertical: 0,
    fontFamily: LibraryFonts.serif,
    fontSize: 13,
    color: LibraryColors.ink,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LibraryColors.pencil,
  },
  noteText: {
    fontFamily: LibraryFonts.pen,
    fontSize: 20,
    // Taller than the font's natural line height, or iOS ignores it and AutoGrowInput undershoots
    lineHeight: 30,
    color: LibraryColors.pencil,
  },
  addQuote: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  addQuoteText: {
    fontFamily: LibraryFonts.serif,
    fontSize: 14,
    color: LibraryColors.pencil,
  },
});
