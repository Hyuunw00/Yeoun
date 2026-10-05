import type { SQLiteDatabase } from 'expo-sqlite';

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
    `INSERT INTO works (category, external_id, title, subtitle, year, release_date, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (category, external_id) DO UPDATE SET
       title = excluded.title,
       subtitle = excluded.subtitle,
       year = excluded.year,
       release_date = excluded.release_date,
       image_url = excluded.image_url`,
    work.category,
    work.externalId,
    work.title,
    work.subtitle,
    work.year,
    work.releaseDate,
    work.imageUrl,
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
      'INSERT INTO records (work_id, body, experienced_on, episode, rating) VALUES (?, ?, ?, ?, ?)',
      workId,
      record.body,
      record.experiencedOn,
      record.episode,
      record.rating,
    );
    await insertPhotos(db, result.lastInsertRowId, photos);
    await insertQuotes(db, result.lastInsertRowId, quotes);
  });
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
};

export type WorkSummary = Work & {
  lastExperiencedOn: string;
  lastRating: number | null;
};

export type RecordEntry = {
  id: number;
  body: string;
  experiencedOn: string;
  episode: string | null;
  rating: number | null;
  createdAt: string;
  photos: string[];
  quotes: Quote[];
};

type RecordRow = Omit<RecordEntry, 'photos' | 'quotes'>;

const RECORD_COLUMNS = `id, body, experienced_on AS experiencedOn, episode, rating, created_at AS createdAt`;

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
  w.year, w.release_date AS releaseDate, w.image_url AS imageUrl`;

// Most recently experienced first. `query` matches titles, record bodies and quotes.
export function listWorks(db: SQLiteDatabase, category: Category, query = '') {
  const trimmed = query.trim();
  const pattern = `%${trimmed.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db.getAllAsync<WorkSummary>(
    `SELECT ${WORK_COLUMNS}, MAX(r.experienced_on) AS lastExperiencedOn,
       (SELECT rating FROM records WHERE work_id = w.id
        ORDER BY experienced_on DESC, id DESC LIMIT 1) AS lastRating
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

export async function setReleaseDate(db: SQLiteDatabase, workId: number, releaseDate: string) {
  await db.runAsync('UPDATE works SET release_date = ? WHERE id = ?', releaseDate, workId);
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
       SET body = ?, experienced_on = ?, episode = ?, rating = ?, updated_at = datetime('now')
       WHERE id = ?`,
      record.body,
      record.experiencedOn,
      record.episode,
      record.rating,
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
  return workRemoved;
}

// Records go with it via ON DELETE CASCADE
export async function deleteWork(db: SQLiteDatabase, id: number) {
  const photos = await photoNames(db, 'r.work_id', id);
  await db.runAsync('DELETE FROM works WHERE id = ?', id);
  deletePhotoFiles(photos);
}
