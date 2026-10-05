import type { SQLiteDatabase } from 'expo-sqlite';

import { emitDataChanged } from '@/lib/changes';
import { deletePhotoFiles } from '@/lib/photos';

export type Category = 'movie' | 'book' | 'music' | 'travel';

export type WorkInput = {
  category: Category;
  externalId: string;
  title: string;
  subtitle: string | null;
  year: string | null;
  releaseDate: string | null;
  imageUrl: string | null;
  // Music release format; left as is when omitted
  format?: string | null;
  // Travel: where the city is, for its pin on the map
  latitude?: number | null;
  longitude?: number | null;
  countryCode?: string | null;
};

export type Quote = {
  quote: string;
  page: string | null;
  note: string | null;
};

export type RecordInput = {
  body: string;
  experiencedOn: string;
  episode: string | null;
  rating: number | null;
  track?: string | null;
  moment?: string | null;
  // Travel: the day the trip ended, when it spans several days
  endedOn?: string | null;
  // Travel: how the trip was made ('plane' | 'train' | 'bus' | 'car' | 'ship')
  transport?: string | null;
  // Travel: JSON of the home city the trip left from, kept as it was at the time.
  // Left unchanged on update when omitted.
  origin?: string | null;
};

// Each entry upgrades the schema to version (index + 1). Append only; never edit a shipped step.
const MIGRATIONS = [
  `CREATE TABLE works (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     category TEXT NOT NULL,
     external_id TEXT NOT NULL,
     title TEXT NOT NULL,
     subtitle TEXT,
     year TEXT,
     image_url TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE (category, external_id)
   );
   CREATE TABLE records (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
     body TEXT NOT NULL,
     experienced_on TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX records_work_id ON records(work_id);`,
  // Optional season/episode note for series
  'ALTER TABLE records ADD COLUMN episode TEXT',
  // Optional personal rating, 0.5 to 5 in half steps
  'ALTER TABLE records ADD COLUMN rating REAL',
  // Full release / first air date (YYYY-MM-DD); `year` stays for compact display
  'ALTER TABLE works ADD COLUMN release_date TEXT',
  // Photo file names (stored under the app's photos directory) per record
  `CREATE TABLE record_photos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
     file_name TEXT NOT NULL,
     position INTEGER NOT NULL
   );
   CREATE INDEX record_photos_record_id ON record_photos(record_id);`,
  // Underlined passages from a book: the quote, its page and my thought on it
  `CREATE TABLE record_quotes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
     quote TEXT NOT NULL,
     page TEXT,
     note TEXT,
     position INTEGER NOT NULL
   );
   CREATE INDEX record_quotes_record_id ON record_quotes(record_id);`,
  // Wide still and credits (JSON) fetched once for the theater screen
  `ALTER TABLE works ADD COLUMN backdrop_url TEXT;
   ALTER TABLE works ADD COLUMN credits TEXT;`,
  // Music: the track that stuck, and where / in what moment it was heard
  `ALTER TABLE records ADD COLUMN track TEXT;
   ALTER TABLE records ADD COLUMN moment TEXT;`,
  // Music release format (single / ep / album)
  'ALTER TABLE works ADD COLUMN format TEXT',
  // Travel: the city's location and ISO country code
  `ALTER TABLE works ADD COLUMN latitude REAL;
   ALTER TABLE works ADD COLUMN longitude REAL;
   ALTER TABLE works ADD COLUMN country_code TEXT;`,
  // Travel: last day of a multi-day trip
  'ALTER TABLE records ADD COLUMN ended_on TEXT',
  // Travel: chosen postcard photo, how each trip was made and where it left from
  `ALTER TABLE works ADD COLUMN cover_photo TEXT;
   ALTER TABLE records ADD COLUMN transport TEXT;
   ALTER TABLE records ADD COLUMN origin TEXT;`,
];

export async function migrate(db: SQLiteDatabase) {
  // Per-connection settings, so they run on every open (and outside any transaction)
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  // Each step commits together with its version bump, so a crash mid-upgrade
  // resumes from the last completed step instead of re-running it
  for (let version = current; version < MIGRATIONS.length; version++) {
    // Exclusive: runs on its own connection, so nothing else can interleave with a schema change
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(MIGRATIONS[version]);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

// Returns the existing work id when the same work was recorded before
async function upsertWork(db: SQLiteDatabase, work: WorkInput) {
  await db.runAsync(
    `INSERT INTO works (category, external_id, title, subtitle, year, release_date, image_url, format,
       latitude, longitude, country_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (category, external_id) DO UPDATE SET
       title = excluded.title,
       subtitle = excluded.subtitle,
       year = excluded.year,
       release_date = excluded.release_date,
       image_url = excluded.image_url,
       format = COALESCE(excluded.format, works.format),
       latitude = COALESCE(excluded.latitude, works.latitude),
       longitude = COALESCE(excluded.longitude, works.longitude),
       country_code = COALESCE(excluded.country_code, works.country_code)`,
    work.category,
    work.externalId,
    work.title,
    work.subtitle,
    work.year,
    work.releaseDate,
    work.imageUrl,
    work.format ?? null,
    work.latitude ?? null,
    work.longitude ?? null,
    work.countryCode ?? null,
  );
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM works WHERE category = ? AND external_id = ?',
    work.category,
    work.externalId,
  );
  return row!.id;
}

async function insertPhotos(db: SQLiteDatabase, recordId: number, photos: string[]) {
  for (const [position, fileName] of photos.entries()) {
    await db.runAsync(
      'INSERT INTO record_photos (record_id, file_name, position) VALUES (?, ?, ?)',
      recordId,
      fileName,
      position,
    );
  }
}

async function insertQuotes(db: SQLiteDatabase, recordId: number, quotes: Quote[]) {
  for (const [position, q] of quotes.entries()) {
    await db.runAsync(
      'INSERT INTO record_quotes (record_id, quote, page, note, position) VALUES (?, ?, ?, ?, ?)',
      recordId,
      q.quote,
      q.page,
      q.note,
      position,
    );
  }
}

async function photoNames(db: SQLiteDatabase, where: string, id: number) {
  const rows = await db.getAllAsync<{ fileName: string }>(
    `SELECT p.file_name AS fileName FROM record_photos p
     JOIN records r ON r.id = p.record_id
     WHERE ${where} = ?`,
    id,
  );
  return rows.map((row) => row.fileName);
}

export async function saveRecord(
  db: SQLiteDatabase,
  work: WorkInput,
  record: RecordInput,
  photos: string[],
  quotes: Quote[] = [],
) {
  await db.withTransactionAsync(async () => {
    const workId = await upsertWork(db, work);
    const result = await db.runAsync(
      `INSERT INTO records (work_id, body, experienced_on, episode, rating, track, moment, ended_on,
         transport, origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      workId,
      record.body,
      record.experiencedOn,
      record.episode,
      record.rating,
      record.track ?? null,
      record.moment ?? null,
      record.endedOn ?? null,
      record.transport ?? null,
      record.origin ?? null,
    );
    await insertPhotos(db, result.lastInsertRowId, photos);
    await insertQuotes(db, result.lastInsertRowId, quotes);
  });
  emitDataChanged();
}

export type Work = {
  id: number;
  category: Category;
  externalId: string;
  title: string;
  subtitle: string | null;
  year: string | null;
  releaseDate: string | null;
  imageUrl: string | null;
  backdropUrl: string | null;
  // JSON-encoded credits; null until fetched
  credits: string | null;
  // Music only: 'single' | 'ep' | 'album'; null until known
  format: string | null;
  // Travel only
  latitude: number | null;
  longitude: number | null;
  countryCode: string | null;
  // Photo file chosen for the postcard front; null picks one automatically
  coverPhoto: string | null;
};

export type WorkSummary = Work & {
  lastExperiencedOn: string;
  // Last day of the latest record, when it spans several days (travel)
  lastEndedOn: string | null;
  lastRating: number | null;
  // A photo to show for the work: the chosen cover, else the latest record's first photo
  photo: string | null;
};

export type RecordEntry = {
  id: number;
  body: string;
  experiencedOn: string;
  endedOn: string | null;
  transport: string | null;
  origin: string | null;
  episode: string | null;
  rating: number | null;
  track: string | null;
  moment: string | null;
  createdAt: string;
  photos: string[];
  quotes: Quote[];
};

type RecordRow = Omit<RecordEntry, 'photos' | 'quotes'>;

const RECORD_COLUMNS = `id, body, experienced_on AS experiencedOn, ended_on AS endedOn, transport, origin, episode,
  rating, track, moment,
  created_at AS createdAt`;

async function attachPhotos(db: SQLiteDatabase, rows: RecordRow[]): Promise<RecordEntry[]> {
  if (rows.length === 0) return [];
  const photos = await db.getAllAsync<{ recordId: number; fileName: string }>(
    `SELECT record_id AS recordId, file_name AS fileName FROM record_photos
     WHERE record_id IN (${rows.map(() => '?').join(', ')})
     ORDER BY position`,
    ...rows.map((row) => row.id),
  );
  const quotes = await db.getAllAsync<Quote & { recordId: number }>(
    `SELECT record_id AS recordId, quote, page, note FROM record_quotes
     WHERE record_id IN (${rows.map(() => '?').join(', ')})
     ORDER BY position`,
    ...rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    ...row,
    photos: photos.filter((p) => p.recordId === row.id).map((p) => p.fileName),
    quotes: quotes
      .filter((q) => q.recordId === row.id)
      .map(({ quote, page, note }) => ({ quote, page, note })),
  }));
}

const WORK_COLUMNS = `w.id, w.category, w.external_id AS externalId, w.title, w.subtitle,
  w.year, w.release_date AS releaseDate, w.image_url AS imageUrl,
  w.backdrop_url AS backdropUrl, w.credits, w.format, w.latitude, w.longitude,
  w.country_code AS countryCode, w.cover_photo AS coverPhoto`;

// Most recently experienced first. `query` matches titles, record bodies and quotes.
export function listWorks(db: SQLiteDatabase, category: Category, query = '') {
  const trimmed = query.trim();
  const pattern = `%${trimmed.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db.getAllAsync<WorkSummary>(
    `SELECT ${WORK_COLUMNS}, MAX(r.experienced_on) AS lastExperiencedOn,
       (SELECT rating FROM records WHERE work_id = w.id
        ORDER BY experienced_on DESC, id DESC LIMIT 1) AS lastRating,
       (SELECT ended_on FROM records WHERE work_id = w.id
        ORDER BY experienced_on DESC, id DESC LIMIT 1) AS lastEndedOn,
       -- Two lookups: SQLite can't read the outer w.cover_photo inside a subquery's ORDER BY
       COALESCE(
         (SELECT p.file_name FROM record_photos p JOIN records pr ON pr.id = p.record_id
          WHERE pr.work_id = w.id AND p.file_name = w.cover_photo LIMIT 1),
         (SELECT p.file_name FROM record_photos p JOIN records pr ON pr.id = p.record_id
          WHERE pr.work_id = w.id ORDER BY pr.experienced_on DESC, pr.id DESC, p.position LIMIT 1)
       ) AS photo
     FROM works w
     JOIN records r ON r.work_id = w.id
     WHERE w.category = ?
       AND (? = '' OR w.title LIKE ? ESCAPE '\\' OR w.subtitle LIKE ? ESCAPE '\\'
         OR EXISTS (SELECT 1 FROM records sr WHERE sr.work_id = w.id AND sr.body LIKE ? ESCAPE '\\')
         OR EXISTS (SELECT 1 FROM record_quotes q JOIN records qr ON qr.id = q.record_id
                    WHERE qr.work_id = w.id AND (q.quote LIKE ? ESCAPE '\\' OR q.note LIKE ? ESCAPE '\\')))
     GROUP BY w.id
     ORDER BY MAX(r.experienced_on) DESC, MAX(r.id) DESC`,
    category,
    trimmed,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
  );
}

export function getWork(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Work>(`SELECT ${WORK_COLUMNS} FROM works w WHERE w.id = ?`, id);
}

// Oldest first, so the credits read like a timeline of rewatches
export async function listRecords(db: SQLiteDatabase, workId: number) {
  const rows = await db.getAllAsync<RecordRow>(
    `SELECT ${RECORD_COLUMNS} FROM records
     WHERE work_id = ?
     ORDER BY experienced_on ASC, id ASC`,
    workId,
  );
  return attachPhotos(db, rows);
}

// Details fetched after the work was saved (release date, wide still, credits)
export async function setWorkDetails(
  db: SQLiteDatabase,
  workId: number,
  details: { releaseDate: string | null; backdropUrl: string | null; credits: string },
) {
  await db.runAsync(
    `UPDATE works
     SET release_date = COALESCE(?, release_date), backdrop_url = ?, credits = ?
     WHERE id = ?`,
    details.releaseDate,
    details.backdropUrl,
    details.credits,
    workId,
  );
  emitDataChanged();
}

export async function setWorkFormat(db: SQLiteDatabase, workId: number, format: string) {
  await db.runAsync('UPDATE works SET format = ? WHERE id = ?', format, workId);
  emitDataChanged();
}

export type TravelRoute = {
  recordId: number;
  workId: number;
  transport: string | null;
  // JSON of the home city, as stored on the record
  origin: string;
  latitude: number;
  longitude: number;
  // The destination's country
  countryCode: string | null;
};

// Every trip that knows where it left from, for drawing routes on the map
export function listTravelRoutes(db: SQLiteDatabase) {
  return db.getAllAsync<TravelRoute>(
    `SELECT r.id AS recordId, w.id AS workId, r.transport, r.origin, w.latitude, w.longitude,
       w.country_code AS countryCode
     FROM records r JOIN works w ON w.id = r.work_id
     WHERE w.category = 'travel' AND r.origin IS NOT NULL
       AND w.latitude IS NOT NULL AND w.longitude IS NOT NULL
     ORDER BY r.experienced_on`,
  );
}

// Whether a trip to this city starting on this day is already recorded
export async function hasTravelRecord(db: SQLiteDatabase, externalId: string, startedOn: string) {
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT r.id FROM records r JOIN works w ON w.id = r.work_id
     WHERE w.category = 'travel' AND w.external_id = ? AND r.experienced_on = ?`,
    externalId,
    startedOn,
  );
  return !!row;
}

const NO_ORIGIN = `origin IS NULL AND work_id IN (SELECT id FROM works WHERE category = 'travel')`;

// Trips recorded before home was set don't know where they left from
export async function countTripsWithoutOrigin(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM records WHERE ${NO_ORIGIN}`);
  return row?.count ?? 0;
}

// Stores `origin` (home city JSON) on every such trip, so it stays put if home moves later
export async function fillMissingOrigins(db: SQLiteDatabase, origin: string) {
  await db.runAsync(`UPDATE records SET origin = ?, updated_at = datetime('now') WHERE ${NO_ORIGIN}`, origin);
  emitDataChanged();
}

export async function setWorkCover(db: SQLiteDatabase, workId: number, fileName: string | null) {
  await db.runAsync('UPDATE works SET cover_photo = ? WHERE id = ?', fileName, workId);
  emitDataChanged();
}

export async function getRecord(db: SQLiteDatabase, id: number) {
  const row = await db.getFirstAsync<RecordRow>(`SELECT ${RECORD_COLUMNS} FROM records WHERE id = ?`, id);
  if (!row) return null;
  const [record] = await attachPhotos(db, [row]);
  return record;
}

export async function updateRecord(
  db: SQLiteDatabase,
  id: number,
  record: RecordInput,
  photos: string[],
  // Omit to leave existing quotes untouched (categories without quotes)
  quotes?: Quote[],
) {
  const previous = await photoNames(db, 'r.id', id);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE records
       SET body = ?, experienced_on = ?, episode = ?, rating = ?, track = ?, moment = ?, ended_on = ?,
           transport = ?, origin = COALESCE(?, origin), updated_at = datetime('now')
       WHERE id = ?`,
      record.body,
      record.experiencedOn,
      record.episode,
      record.rating,
      record.track ?? null,
      record.moment ?? null,
      record.endedOn ?? null,
      record.transport ?? null,
      record.origin ?? null,
      id,
    );
    await db.runAsync('DELETE FROM record_photos WHERE record_id = ?', id);
    await insertPhotos(db, id, photos);
    if (quotes) {
      await db.runAsync('DELETE FROM record_quotes WHERE record_id = ?', id);
      await insertQuotes(db, id, quotes);
    }
  });
  // Files are removed only after the DB change has committed
  deletePhotoFiles(previous.filter((name) => !photos.includes(name)));
  emitDataChanged();
}

// Removes the work too once its last record is gone. Returns true in that case.
export async function deleteRecord(db: SQLiteDatabase, id: number) {
  const photos = await photoNames(db, 'r.id', id);
  let workRemoved = false;
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ workId: number }>(
      'SELECT work_id AS workId FROM records WHERE id = ?',
      id,
    );
    if (!row) return;
    await db.runAsync('DELETE FROM records WHERE id = ?', id);
    const result = await db.runAsync(
      'DELETE FROM works WHERE id = ? AND NOT EXISTS (SELECT 1 FROM records WHERE work_id = ?)',
      row.workId,
      row.workId,
    );
    workRemoved = result.changes > 0;
  });
  deletePhotoFiles(photos);
  emitDataChanged();
  return workRemoved;
}

// Records go with it via ON DELETE CASCADE
export async function deleteWork(db: SQLiteDatabase, id: number) {
  const photos = await photoNames(db, 'r.work_id', id);
  await db.runAsync('DELETE FROM works WHERE id = ?', id);
  deletePhotoFiles(photos);
  emitDataChanged();
}
