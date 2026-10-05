import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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

import { AutoGrowInput } from '@/components/auto-grow-input';
import { StarRating } from '@/components/cinema/star-rating';
import { CinemaFonts } from '@/components/cinema/theme';
import { PhotoPickerRow } from '@/components/photo-picker-row';
import { RecordColors } from '@/components/record-shop/theme';
import { toDateString } from '@/lib/date';
import type { MusicResult } from '@/lib/itunes';
import { useRecordEditor } from '@/lib/use-record-editor';

// A single holds one song, so picking the single itself still fills in the track
function singleTrackName(music: MusicResult) {
  return music.format === 'single' ? music.albumTitle.replace(/ - Single$/i, '') : null;
}

export default function MusicWriteScreen() {
  // `id` is the album's external id; `music` carries the search result for a new record.
  // `recordId` + `workId` switch the screen to editing an existing record.
  const { id, music: musicParam, from, recordId, workId } = useLocalSearchParams<{
    id: string;
    music?: string;
    from?: 'work';
    recordId?: string;
    workId?: string;
  }>();

  // A malformed param (e.g. from a deep link) shows an error instead of crashing the render
  const music = useMemo(() => {
    if (!musicParam) return null;
    try {
      const parsed = JSON.parse(musicParam) as Partial<MusicResult>;
      return parsed.albumTitle ? (parsed as MusicResult) : null;
    } catch {
      return null;
    }
  }, [musicParam]);

  // iTunes often returns romanized names, so a new album's title and artist are editable
  const [albumTitle, setAlbumTitle] = useState(music?.albumTitle ?? '');
  const [artist, setArtist] = useState(music?.artist ?? '');

  const editor = useRecordEditor({
    category: 'music',
    externalId: id,
    recordId,
    workId,
    initialTrack: music ? (music.trackName ?? singleTrackName(music)) : null,
    newWork:
      music && albumTitle.trim()
        ? {
            category: 'music',
            externalId: id,
            title: albumTitle.trim(),
            subtitle: artist.trim() || null,
            year: music.releaseDate?.slice(0, 4) || null,
            releaseDate: music.releaseDate,
            imageUrl: music.artworkUrl,
            format: music.format,
          }
        : null,
    onSaved: (isEdit) => {
      // Back to the album when editing or listening again, otherwise to the crate
      if (isEdit || from === 'work') router.back();
      else router.dismissTo('/music');
    },
    onWorkRemoved: () => router.dismissTo('/music'),
  });
  const { isEdit, savedWork, saving, canSave } = editor;

  const artworkUrl = isEdit ? savedWork?.imageUrl : music?.artworkUrl;
  const ready = isEdit ? !!savedWork : !!music;

  return (
    <View style={styles.container}>
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
                  <ActivityIndicator color={RecordColors.neon} />
                ) : (
                  <Text style={[styles.save, !canSave && styles.disabled]}>남기기</Text>
                )}
              </Pressable>
            </View>
          </View>

          {!ready ? (
            editor.recordError || (!isEdit && !music) ? (
              <Text style={styles.status}>{isEdit ? '기록을 불러오지 못했어요' : '앨범 정보를 불러오지 못했어요'}</Text>
            ) : (
              <ActivityIndicator style={styles.status} color={RecordColors.textDim} />
            )
          ) : (
            <ScrollView contentContainerStyle={styles.page} keyboardDismissMode="interactive">
              <View style={styles.album}>
                {artworkUrl ? (
                  <Image source={artworkUrl} style={styles.cover} contentFit="cover" />
                ) : (
                  <View style={styles.cover} />
                )}
                <View style={styles.albumInfo}>
                  {isEdit ? (
                    <>
                      <Text style={styles.title}>{savedWork?.title}</Text>
                      {!!savedWork?.subtitle && <Text style={styles.meta}>{savedWork.subtitle}</Text>}
                    </>
                  ) : (
                    <>
                      <TextInput
                        style={[styles.title, styles.editable]}
                        value={albumTitle}
                        onChangeText={setAlbumTitle}
                        placeholder="앨범 제목"
                        placeholderTextColor={RecordColors.textDim}
                        selectionColor={RecordColors.neon}
                        keyboardAppearance="dark"
                      />
                      <TextInput
                        style={[styles.meta, styles.editable]}
                        value={artist}
                        onChangeText={setArtist}
                        placeholder="아티스트"
                        placeholderTextColor={RecordColors.textDim}
                        selectionColor={RecordColors.neon}
                        keyboardAppearance="dark"
                      />
                    </>
                  )}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>들은 날</Text>
                <DateTimePicker
                  value={editor.pickerDate}
                  mode="date"
                  display="compact"
                  locale="ko-KR"
                  themeVariant="dark"
                  accentColor={RecordColors.neon}
                  maximumDate={new Date()}
                  onValueChange={(_, date) => editor.setExperiencedOn(toDateString(date))}
                />
              </View>

              <View style={styles.lineField}>
                <Text style={styles.label}>꽂힌 트랙</Text>
                <TextInput
                  style={styles.lineInput}
                  value={editor.track}
                  onChangeText={editor.setTrack}
                  placeholder="자꾸 돌려 들은 곡 (선택)"
                  placeholderTextColor={RecordColors.textDim}
                  selectionColor={RecordColors.neon}
                  keyboardAppearance="dark"
                />
              </View>

              <View style={styles.lineField}>
                <Text style={styles.label}>들은 순간</Text>
                <TextInput
                  style={styles.lineInput}
                  value={editor.moment}
                  onChangeText={editor.setMoment}
                  placeholder="출근길 지하철, 비 오는 밤 산책… (선택)"
                  placeholderTextColor={RecordColors.textDim}
                  selectionColor={RecordColors.neon}
                  keyboardAppearance="dark"
                />
              </View>

              <View style={styles.field}>
                <StarRating
                  value={editor.rating}
                  onChange={editor.setRating}
                  filledColor={RecordColors.neon}
                  emptyColor={RecordColors.hairline}
                />
                <Text style={styles.meta}>{editor.rating !== null ? editor.rating.toFixed(1) : '별점 (선택)'}</Text>
              </View>

              <PhotoPickerRow
                photos={editor.photos}
                picking={editor.picking}
                onAdd={editor.addPhotos}
                onRemove={editor.removePhoto}
                fontFamily={CinemaFonts.serif}
                colors={{
                  border: RecordColors.hairline,
                  text: RecordColors.textDim,
                  badge: RecordColors.wallLight,
                  badgeText: RecordColors.neon,
                }}
              />

              <AutoGrowInput
                style={styles.body}
                minHeight={160}
                value={editor.body}
                onChangeText={editor.setBody}
                placeholder="AI의 도움 없이, 이 음악이 남긴 것을 그대로 적어보세요"
                placeholderTextColor={RecordColors.textDim}
                selectionColor={RecordColors.neon}
                keyboardAppearance="dark"
              />
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
    backgroundColor: RecordColors.wall,
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
    fontFamily: CinemaFonts.serif,
    fontSize: 14,
    color: RecordColors.textDim,
  },
  save: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 15,
    color: RecordColors.neon,
  },
  disabled: {
    opacity: 0.35,
  },
  status: {
    marginVertical: 24,
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    color: RecordColors.textDim,
  },
  page: {
    paddingHorizontal: 20,
    paddingBottom: 80,
    gap: 18,
  },
  album: {
    flexDirection: 'row',
    gap: 16,
  },
  cover: {
    width: 96,
    height: 96,
    backgroundColor: RecordColors.wallLight,
  },
  albumInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  title: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 17,
    color: RecordColors.text,
  },
  meta: {
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: RecordColors.textDim,
  },
  // Fixed height with no vertical padding keeps single-line text vertically centered
  editable: {
    height: 30,
    paddingVertical: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RecordColors.hairline,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lineField: {
    gap: 6,
  },
  label: {
    fontFamily: CinemaFonts.serif,
    fontSize: 12,
    letterSpacing: 1,
    color: RecordColors.textDim,
  },
  lineInput: {
    height: 32,
    paddingVertical: 0,
    fontFamily: CinemaFonts.serif,
    fontSize: 15,
    color: RecordColors.text,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RecordColors.hairline,
  },
  // Explicit lineHeight so AutoGrowInput can size it exactly
  body: {
    fontFamily: CinemaFonts.serif,
    fontSize: 16,
    lineHeight: 26,
    color: RecordColors.text,
    textAlignVertical: 'top',
  },
});
