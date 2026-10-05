import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilmGrain } from '@/components/cinema/film-grain';
import { StarRating } from '@/components/cinema/star-rating';
import { CinemaColors, CinemaFonts } from '@/components/cinema/theme';
import { toDateString } from '@/lib/date';
import { MAX_PHOTOS_PER_RECORD } from '@/lib/photos';
import { getTitle, isSeries, parseExternalId, posterUrl, toExternalId, type TmdbTitle } from '@/lib/tmdb';
import { useRecordEditor } from '@/lib/use-record-editor';

export default function MovieWriteScreen() {
  // `id` is the work's external id ("123" for a movie, "tv:123" for a series)
  // `recordId` + `workId` switch the screen to editing an existing record
  const { id, from, recordId, workId } = useLocalSearchParams<{
    id: string;
    from?: 'work';
    recordId?: string;
    workId?: string;
  }>();

  // New records come from TMDB; edits use the work already saved in the DB,
  // so an existing record stays editable offline
  const [movie, setMovie] = useState<TmdbTitle | null>(null);
  const [movieError, setMovieError] = useState(false);

  useEffect(() => {
    if (recordId) return;
    const controller = new AbortController();
    const { mediaType, id: tmdbId } = parseExternalId(id);
    getTitle(mediaType, tmdbId, controller.signal)
      .then(setMovie)
      .catch(() => {
        if (!controller.signal.aborted) setMovieError(true);
      });
    return () => controller.abort();
  }, [id, recordId]);

  const editor = useRecordEditor({
    category: 'movie',
    externalId: id,
    recordId,
    workId,
    newWork: movie && {
      category: 'movie',
      externalId: toExternalId(movie),
      title: movie.title,
      subtitle: movie.originalTitle !== movie.title ? movie.originalTitle : null,
      year: movie.releaseDate?.slice(0, 4) || null,
      releaseDate: movie.releaseDate || null,
      imageUrl: movie.posterPath ? posterUrl(movie.posterPath, 'w500') : null,
    },
    onSaved: (isEdit) => {
      // Back to the work screen when editing or re-recording, otherwise to the lobby
      if (isEdit || from === 'work') router.back();
      else router.dismissTo('/movie');
    },
    // With its last record gone the work screen is empty, so go back to the lobby
    onWorkRemoved: () => router.dismissTo('/movie'),
  });
  const {
    isEdit,
    savedWork,
    body,
    setBody,
    setExperiencedOn,
    pickerDate,
    episode,
    setEpisode,
    rating,
    setRating,
    photos,
    addPhotos,
    removePhoto,
    picking,
    saving,
    canSave,
  } = editor;
  const loadError = isEdit ? editor.recordError : movieError;

  const header = isEdit
    ? savedWork && {
        title: savedWork.title,
        posterUri: savedWork.imageUrl,
        isSeries: isSeries(savedWork.externalId),
        releaseDate: savedWork.releaseDate,
      }
    : movie && {
        title: movie.title,
        posterUri: movie.posterPath ? posterUrl(movie.posterPath, 'w342') : null,
        isSeries: movie.mediaType === 'tv',
        releaseDate: movie.releaseDate || null,
      };

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
                  <ActivityIndicator color={CinemaColors.brass} />
                ) : (
                  <Text style={[styles.save, !canSave && styles.disabled]}>남기기</Text>
                )}
              </Pressable>
            </View>
          </View>

          {header ? (
            <>
              <View style={styles.movie}>
                {header.posterUri ? (
                  <Image source={header.posterUri} style={styles.poster} contentFit="cover" />
                ) : (
                  <View style={styles.poster} />
                )}
                <View style={styles.movieInfo}>
                  <Text style={styles.title} numberOfLines={2}>
                    {header.title}
                  </Text>
                  <Text style={styles.meta}>
                    {[
                      header.isSeries && 'SERIES',
                      header.releaseDate &&
                        `${header.isSeries ? '첫 방영' : '개봉'} ${header.releaseDate.replaceAll('-', '.')}`,
                    ]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </Text>
                  {header.isSeries && (
                    <TextInput
                      style={styles.episode}
                      value={episode}
                      onChangeText={setEpisode}
                      placeholder="시즌·회차 (선택)"
                      placeholderTextColor={CinemaColors.textDim}
                      selectionColor={CinemaColors.brass}
                      keyboardAppearance="dark"
                      returnKeyType="done"
                    />
                  )}
                  <View style={styles.dateRow}>
                    <Text style={styles.meta}>관람일</Text>
                    <DateTimePicker
                      value={pickerDate}
                      mode="date"
                      display="compact"
                      locale="ko-KR"
                      themeVariant="dark"
                      accentColor={CinemaColors.brass}
                      maximumDate={new Date()}
                      onValueChange={(_, date) => setExperiencedOn(toDateString(date))}
                    />
                  </View>
                </View>
              </View>
              <View style={styles.ratingRow}>
                <StarRating value={rating} onChange={setRating} />
                <Text style={styles.meta}>{rating !== null ? rating.toFixed(1) : '별점 (선택)'}</Text>
              </View>
              <View style={styles.photoRow}>
                {photos.map((photo, index) => (
                  <View key={photo.uri} style={styles.photo}>
                    <Image source={photo.uri} style={styles.photoImage} contentFit="cover" />
                    <Pressable style={styles.photoRemove} onPress={() => removePhoto(index)} hitSlop={8}>
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                {photos.length < MAX_PHOTOS_PER_RECORD && (
                  <Pressable style={[styles.photo, styles.photoAdd]} onPress={addPhotos} disabled={picking}>
                    {picking ? (
                      <ActivityIndicator color={CinemaColors.textDim} />
                    ) : (
                      <Text style={styles.photoAddText}>
                        사진{'\n'}
                        {photos.length}/{MAX_PHOTOS_PER_RECORD}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </>
          ) : loadError ? (
            <Text style={styles.status}>{isEdit ? '기록을 불러오지 못했어요' : '영화 정보를 불러오지 못했어요'}</Text>
          ) : (
            <ActivityIndicator style={styles.status} color={CinemaColors.textDim} />
          )}

          <TextInput
            style={styles.input}
            value={body}
            onChangeText={setBody}
            placeholder="AI의 도움 없이, 지금 떠오르는 생각을 그대로 적어보세요"
            placeholderTextColor={CinemaColors.textDim}
            selectionColor={CinemaColors.brass}
            keyboardAppearance="dark"
            multiline
            textAlignVertical="top"
            autoFocus
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      <FilmGrain opacity={0.05} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CinemaColors.theater,
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
    color: CinemaColors.textDim,
  },
  save: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 15,
    color: CinemaColors.brass,
  },
  disabled: {
    opacity: 0.35,
  },
  movie: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  poster: {
    width: 72,
    height: 108,
    backgroundColor: '#111',
    opacity: 0.85,
  },
  movieInfo: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: CinemaFonts.serifBold,
    fontSize: 18,
    color: CinemaColors.text,
  },
  meta: {
    fontFamily: CinemaFonts.serif,
    fontSize: 12,
    color: CinemaColors.textDim,
  },
  // Fixed height with no vertical padding keeps the placeholder vertically centered
  episode: {
    alignSelf: 'flex-start',
    minWidth: 140,
    height: 28,
    paddingVertical: 0,
    fontFamily: CinemaFonts.serif,
    fontSize: 13,
    color: CinemaColors.brass,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: CinemaColors.plaqueBorder,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  photo: {
    width: 64,
    height: 64,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#111',
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CinemaColors.plaque,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CinemaColors.plaqueBorder,
  },
  photoRemoveText: {
    fontSize: 10,
    color: CinemaColors.brass,
  },
  photoAdd: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: CinemaColors.plaqueBorder,
  },
  photoAddText: {
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    fontSize: 11,
    lineHeight: 16,
    color: CinemaColors.textDim,
  },
  status: {
    marginVertical: 24,
    textAlign: 'center',
    fontFamily: CinemaFonts.serif,
    color: CinemaColors.textDim,
  },
  input: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    fontFamily: CinemaFonts.serif,
    fontSize: 16,
    lineHeight: 28,
    color: CinemaColors.text,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CinemaColors.hairline,
  },
});
