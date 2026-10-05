import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const MAX_PHOTOS_PER_RECORD = 3;

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

// Picks photos and returns resized temporary copies (not yet persisted)
export async function pickPhotos(limit: number) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 1,
  });
  if (result.canceled) return [];

  return Promise.all(
    result.assets.slice(0, limit).map(async (asset) => {
      const context = ImageManipulator.manipulate(asset.uri);
      if (Math.max(asset.width, asset.height) > MAX_DIMENSION) {
        context.resize(asset.width >= asset.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
      }
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
      return saved.uri;
    }),
  );
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
