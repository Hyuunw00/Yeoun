import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useDb } from '@/lib/database';
import { fromDateString, toDateString } from '@/lib/date';
import { deleteRecord, getRecord, getWork, saveRecord, updateRecord, type Work } from '@/lib/db';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';
import { deletePhotoFiles, MAX_PHOTOS_PER_RECORD, persistPhoto, photoUri, pickPhotos } from '@/lib/photos';
import { getTitle, isSeries, parseExternalId, posterUrl, toExternalId, type TmdbTitle } from '@/lib/tmdb';

const DRAFT_SAVE_DELAY_MS = 500;

// `fileName` is set once a photo is persisted; new picks only have a temp uri
type PhotoItem = { uri: string; fileName?: string };

export default function MovieWriteScreen() {
  // `id` is the work's external id ("123" for a movie, "tv:123" for a series)
  // `recordId` + `workId` switch the screen to editing an existing record
  const { id, from, recordId, workId } = useLocalSearchParams<{
    id: string;
    from?: 'work';
    recordId?: string;
    workId?: string;
  }>();
  const isEdit = !!recordId;
  const db = useDb();

  // New records come from TMDB; edits use the work already saved in the DB,
  // so an existing record stays editable offline
  const [movie, setMovie] = useState<TmdbTitle | null>(null);
  const [savedWork, setSavedWork] = useState<Work | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [recordLoaded, setRecordLoaded] = useState(!isEdit);
  const [body, setBody] = useState('');
  const [experiencedOn, setExperiencedOn] = useState(() => toDateString(new Date()));
  const [episode, setEpisode] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  // Guards against a double tap inserting the record twice before re-render
  const savingRef = useRef(false);
  const draftReady = useRef(false);

  useEffect(() => {
    if (isEdit) return;
    const controller = new AbortController();
    const { mediaType, id: tmdbId } = parseExternalId(id);
    getTitle(mediaType, tmdbId, controller.signal)
      .then(setMovie)
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [id, isEdit]);

  useEffect(() => {
    if (recordId) {
      // Editing loads the saved record and skips drafts entirely
      Promise.all([getRecord(db, Number(recordId)), getWork(db, Number(workId))])
        .then(([record, work]) => {
          if (!record || !work) {
            Alert.alert('이미 지워진 기록이에요');
            router.back();
            return;
          }
          setSavedWork(work);
          setBody(record.body);
          setExperiencedOn(record.experiencedOn);
          setEpisode(record.episode ?? '');
          setRating(record.rating);
          setPhotos(record.photos.map((fileName) => ({ uri: photoUri(fileName), fileName })));
          setRecordLoaded(true);
        })
        .catch(() => setLoadError(true));
      return;
    }
    loadDraft('movie', id)
      .catch(() => null)
      .then((draft) => {
        if (!draft) return;
        // Don't clobber anything typed before the draft finished loading
        setBody((prev) => prev || draft.body);
        setExperiencedOn(draft.experiencedOn);
        setEpisode((prev) => prev || (draft.episode ?? ''));
        setRating((prev) => prev ?? draft.rating ?? null);
      })
      .finally(() => {
        draftReady.current = true;
      });
  }, [db, id, recordId, workId]);

  // Persist the draft so an app crash or accidental back doesn't lose writing
  useEffect(() => {
    if (!draftReady.current) return;
    const timer = setTimeout(() => {
      if (body.trim() || rating !== null) saveDraft('movie', id, { body, experiencedOn, episode, rating });
      else clearDraft('movie', id);
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [id, body, experiencedOn, episode, rating]);

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

  // A corrupted draft date would crash the native picker, so fall back to today
  const parsedDate = fromDateString(experiencedOn);
  const pickerDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  // Body is optional: just marking that it was watched is a valid record
  const canSave = (isEdit ? recordLoaded : !!movie) && !saving && !picking;

  async function handleSave() {
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const newlyPersisted: string[] = [];
    try {
      const record = { body: body.trim(), experiencedOn, episode: episode.trim() || null, rating };
      const photoNames = await Promise.all(
        photos.map(async (p) => {
          if (p.fileName) return p.fileName;
          const name = await persistPhoto(p.uri);
          newlyPersisted.push(name);
          return name;
        }),
      );
      if (isEdit) {
        await updateRecord(db, Number(recordId), record, photoNames);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
        return;
      }
      if (!movie) return;
      await saveRecord(
        db,
        {
          category: 'movie',
          externalId: toExternalId(movie),
          title: movie.title,
          subtitle: movie.originalTitle !== movie.title ? movie.originalTitle : null,
          year: movie.releaseDate?.slice(0, 4) || null,
          releaseDate: movie.releaseDate || null,
          imageUrl: movie.posterPath ? posterUrl(movie.posterPath, 'w500') : null,
        },
        record,
        photoNames,
      );
      await clearDraft('movie', id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Return to the work screen when re-recording, otherwise back to home
      if (from === 'work') router.back();
      else router.dismissAll();
    } catch {
      // Drop copies made for this attempt; the temp files remain for a retry
      deletePhotoFiles(newlyPersisted);
      savingRef.current = false;
      setSaving(false);
      Alert.alert('저장하지 못했어요', '잠시 후 다시 시도해주세요');
    }
  }

  async function addPhotos() {
    setPicking(true);
    try {
      const picked = await pickPhotos(MAX_PHOTOS_PER_RECORD - photos.length);
      setPhotos((prev) => [...prev, ...picked.map((uri) => ({ uri }))].slice(0, MAX_PHOTOS_PER_RECORD));
    } catch {
      Alert.alert('사진을 불러오지 못했어요');
    } finally {
      setPicking(false);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function confirmDelete() {
    if (!recordId) return;
    Alert.alert('이 기록을 지울까요?', '지운 기록은 되돌릴 수 없어요', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const workRemoved = await deleteRecord(db, Number(recordId));
            // With its last record gone the work screen is empty, so go back to the lobby
            if (workRemoved) router.dismissAll();
            else router.back();
          } catch {
            Alert.alert('지우지 못했어요', '잠시 후 다시 시도해주세요');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.headerButton}>뒤로</Text>
            </Pressable>
            <View style={styles.headerActions}>
              {!!recordId && (
                <Pressable onPress={confirmDelete} disabled={saving} hitSlop={12}>
                  <Text style={styles.headerButton}>삭제</Text>
                </Pressable>
              )}
              <Pressable onPress={handleSave} disabled={!canSave} hitSlop={12}>
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
  episode: {
    alignSelf: 'flex-start',
    minWidth: 140,
    paddingVertical: 4,
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
