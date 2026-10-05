import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { Category } from '@/lib/db';

export const MAX_PHOTOS_PER_RECORD = 3;
// A trip collects far more photos than a movie or a book
export const MAX_TRAVEL_PHOTOS = 30;

export function maxPhotos(category: Category) {
  return category === 'travel' ? MAX_TRAVEL_PHOTOS : MAX_PHOTOS_PER_RECORD;
}

// Longest side after resizing; keeps files small for storage and future backup
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

// Only file names are stored in the DB because the app container path
// on iOS can change between installs.
export function photoDir() {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ idempotent: true });
  return dir;
}

export function photoFile(fileName: string) {
  return new File(photoDir(), fileName);
}

export function photoUri(fileName: string) {
  return photoFile(fileName).uri;
}

// Full-size photos are decoded at once in memory, so only a few are resized together
const RESIZE_CONCURRENCY = 3;

export async function pickPhotoAssets(limit: number) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 1,
  });
  return result.canceled ? [] : result.assets.slice(0, limit);
}

// A resized temporary copy (not yet persisted)
export async function resizePhotoFile(uri: string, width: number, height: number) {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_DIMENSION) {
    context.resize(width >= height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return saved.uri;
}

const resizePhoto = (asset: ImagePicker.ImagePickerAsset) => resizePhotoFile(asset.uri, asset.width, asset.height);

// Resizes picked photos a few at a time. `onReady` gets each one as soon as it and every
// photo picked before it are done, so they show up in the order they were picked.
export async function resizePhotos(
  assets: ImagePicker.ImagePickerAsset[],
  onReady: (uris: string[], done: number) => void,
) {
  const ready: string[] = [];
  let next = 0;
  let shown = 0;
  let done = 0;
  async function worker() {
    while (next < assets.length) {
      const index = next++;
      ready[index] = await resizePhoto(assets[index]);
      done++;
      const batch: string[] = [];
      while (ready[shown]) batch.push(ready[shown++]);
      onReady(batch, done);
    }
  }
  await Promise.all(Array.from({ length: Math.min(RESIZE_CONCURRENCY, assets.length) }, worker));
}

// Copies a temporary photo into permanent storage and returns its file name.
// Copy rather than move so the temp file stays valid if saving fails and is retried.
export async function persistPhoto(tempUri: string) {
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await new File(tempUri).copy(new File(photoDir(), fileName));
  return fileName;
}

// Best effort: a leftover file is harmless, but throwing here would make an
// already committed DB change look like a failure
export function deletePhotoFiles(fileNames: string[]) {
  for (const name of fileNames) {
    try {
      const file = new File(photoDir(), name);
      if (file.exists) file.delete();
    } catch (e) {
      console.warn('Failed to delete photo', name, e);
    }
  }
}
