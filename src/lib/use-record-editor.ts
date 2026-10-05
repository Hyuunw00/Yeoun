import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useDb } from '@/lib/database';
import { fromDateString, toDateString } from '@/lib/date';
import {
  deleteRecord,
  getRecord,
  getWork,
  saveRecord,
  updateRecord,
  type Category,
  type Quote,
  type Work,
  type WorkInput,
} from '@/lib/db';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';
import { deletePhotoFiles, MAX_PHOTOS_PER_RECORD, persistPhoto, photoUri, pickPhotos } from '@/lib/photos';

const DRAFT_SAVE_DELAY_MS = 500;

// `fileName` is set once a photo is persisted; new picks only have a temp uri
export type PhotoItem = { uri: string; fileName?: string };

type Options = {
  category: Category;
  externalId: string;
  // Present when editing an existing record
  recordId?: string;
  workId?: string;
  // The work to save a new record under; null until its details have loaded
  newWork: WorkInput | null;
  // Whether this category records underlined quotes
  withQuotes?: boolean;
  // Where to go after saving / deleting
  onSaved: (isEdit: boolean) => void;
  onWorkRemoved: () => void;
};

// Shared state and persistence for writing or editing a record in any category:
// drafts, photos, quotes, save and delete.
export function useRecordEditor({
  category,
  externalId,
  recordId,
  workId,
  newWork,
  withQuotes = false,
  onSaved,
  onWorkRemoved,
}: Options) {
  const isEdit = !!recordId;
  const db = useDb();

  const [savedWork, setSavedWork] = useState<Work | null>(null);
  const [recordLoaded, setRecordLoaded] = useState(!isEdit);
  const [recordError, setRecordError] = useState(false);
  const [body, setBody] = useState('');
  const [experiencedOn, setExperiencedOn] = useState(() => toDateString(new Date()));
  const [episode, setEpisode] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  // Guards against a double tap inserting the record twice before re-render
  const savingRef = useRef(false);
  const draftReady = useRef(false);

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
          setQuotes(record.quotes);
          setPhotos(record.photos.map((fileName) => ({ uri: photoUri(fileName), fileName })));
          setRecordLoaded(true);
        })
        .catch(() => setRecordError(true));
      return;
    }
    loadDraft(category, externalId)
      .catch(() => null)
      .then((draft) => {
        if (!draft) return;
        // Don't clobber anything typed before the draft finished loading
        setBody((prev) => prev || draft.body);
        setExperiencedOn(draft.experiencedOn);
        setEpisode((prev) => prev || (draft.episode ?? ''));
        setRating((prev) => prev ?? draft.rating ?? null);
        setQuotes((prev) => (prev.length ? prev : (draft.quotes ?? [])));
      })
      .finally(() => {
        draftReady.current = true;
      });
  }, [db, category, externalId, recordId, workId]);

  // Persist the draft so an app crash or accidental back doesn't lose writing
  useEffect(() => {
    if (!draftReady.current) return;
    const timer = setTimeout(() => {
      const hasContent = body.trim() || rating !== null || quotes.some((q) => q.quote.trim());
      if (hasContent) saveDraft(category, externalId, { body, experiencedOn, episode, rating, quotes });
      else clearDraft(category, externalId);
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [category, externalId, body, experiencedOn, episode, rating, quotes]);

  // A corrupted draft date would crash the native picker, so fall back to today
  const parsedDate = fromDateString(experiencedOn);
  const pickerDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  // Body is optional: just marking that it was experienced is a valid record
  const canSave = (isEdit ? recordLoaded : !!newWork) && !saving && !picking;

  async function save() {
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const newlyPersisted: string[] = [];
    try {
      const record = { body: body.trim(), experiencedOn, episode: episode.trim() || null, rating };
      // Drop empty quote cards; trim optional fields to null
      const cleanQuotes = quotes
        .filter((q) => q.quote.trim())
        .map((q) => ({ quote: q.quote.trim(), page: q.page?.trim() || null, note: q.note?.trim() || null }));
      const photoNames = await Promise.all(
        photos.map(async (p) => {
          if (p.fileName) return p.fileName;
          const name = await persistPhoto(p.uri);
          newlyPersisted.push(name);
          return name;
        }),
      );
      if (isEdit) {
        await updateRecord(db, Number(recordId), record, photoNames, withQuotes ? cleanQuotes : undefined);
      } else {
        if (!newWork) return;
        await saveRecord(db, newWork, record, photoNames, cleanQuotes);
        await clearDraft(category, externalId);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(isEdit);
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
            if (workRemoved) onWorkRemoved();
            else router.back();
          } catch {
            Alert.alert('지우지 못했어요', '잠시 후 다시 시도해주세요');
          }
        },
      },
    ]);
  }

  return {
    isEdit,
    savedWork,
    recordError,
    body,
    setBody,
    experiencedOn,
    setExperiencedOn,
    pickerDate,
    episode,
    setEpisode,
    rating,
    setRating,
    quotes,
    setQuotes,
    photos,
    addPhotos,
    removePhoto,
    picking,
    saving,
    canSave,
    save,
    confirmDelete,
  };
}
