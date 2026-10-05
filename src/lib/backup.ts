import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';

import { emitDataChanged } from '@/lib/changes';
import { photoDir, photoFile } from '@/lib/photos';
import { supabase } from '@/lib/supabase';

// The phone's SQLite stays the source of truth (it works offline); signed-in users get
// a mirror of the same four tables in Supabase, plus photo files in Storage.
// Every sync makes the server match the phone: upsert all rows, delete rows gone locally.

const PHOTO_BUCKET = 'backups';
// Parents first for upserts; deletes run in reverse
const TABLES = ['works', 'records', 'record_photos', 'record_quotes'] as const;
const CHUNK = 500;

const lastSyncKey = (userId: string) => `backup:lastBackupAt:${userId}`;
const uploadedKey = (userId: string) => `backup:uploadedPhotos:${userId}`;

type Table = (typeof TABLES)[number];
type Row = Record<string, unknown>;
type Tables = Record<Table, Row[]>;

// Every sync and restore runs one at a time. Two overlapping syncs could otherwise let
// an older snapshot delete a row a newer sync had just uploaded.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getLastBackupAt() {
  const userId = await currentUserId();
  return userId ? Storage.getItemAsync(lastSyncKey(userId)) : null;
}

// Drops rows whose parent is missing, which can happen if a write lands between
// reading two tables. Keeps the server consistent and restores from failing on FKs.
export function withoutOrphans(tables: Tables): Tables {
  const workIds = new Set(tables.works.map((w) => Number(w.id)));
  const records = tables.records.filter((r) => workIds.has(Number(r.work_id)));
  const recordIds = new Set(records.map((r) => Number(r.id)));
  return {
    works: tables.works,
    records,
    record_photos: tables.record_photos.filter((p) => recordIds.has(Number(p.record_id))),
    record_quotes: tables.record_quotes.filter((q) => recordIds.has(Number(q.record_id))),
  };
}

async function fetchAllRemote(table: string, columns: string) {
  const rows: Row[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < pageSize) return rows;
  }
}

async function readUploaded(userId: string) {
  return new Set<string>(JSON.parse((await Storage.getItemAsync(uploadedKey(userId))) ?? '[]'));
}

async function uploadMissingPhotos(userId: string, fileNames: string[]) {
  const uploaded = await readUploaded(userId);
  for (const name of fileNames) {
    if (uploaded.has(name)) continue;
    const file = photoFile(name);
    if (!file.exists) continue;
    const bytes = await file.bytes();
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(`${userId}/photos/${name}`, bytes.buffer, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    uploaded.add(name);
    await Storage.setItemAsync(uploadedKey(userId), JSON.stringify([...uploaded]));
  }
}

async function readLocal(db: SQLiteDatabase): Promise<Tables> {
  const local = {} as Tables;
  for (const table of TABLES) {
    local[table] = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
  }
  return withoutOrphans(local);
}

type BackupOptions = {
  // Automatic syncs refuse to empty a server that has records; a manual overwrite may
  auto?: boolean;
};

// Makes the server tables match the phone. Returns null when signed out.
export function backupNow(db: SQLiteDatabase, { auto = false }: BackupOptions = {}) {
  return serialized(async () => {
    const userId = await currentUserId();
    if (!userId) return null;

    const local = await readLocal(db);

    // Photo files first, so a photo row never points at a file missing from Storage
    await uploadMissingPhotos(
      userId,
      local.record_photos.map((row) => String(row.file_name)),
    );

    for (const table of TABLES) {
      const rows = local[table].map((row) => ({ ...row, user_id: userId }));
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase
          .from(table)
          .upsert(rows.slice(i, i + CHUNK), { onConflict: 'user_id,id' });
        if (error) throw error;
      }
    }

    // Rows gone from the phone: collect them all before deleting anything
    const stale = {} as Record<Table, number[]>;
    const stalePhotoFiles: string[] = [];
    for (const table of TABLES) {
      const localIds = new Set(local[table].map((row) => Number(row.id)));
      const remote = await fetchAllRemote(table, table === 'record_photos' ? 'id, file_name' : 'id');
      const gone = remote.filter((row) => !localIds.has(Number(row.id)));
      stale[table] = gone.map((row) => Number(row.id));
      if (table === 'record_photos') {
        const kept = new Set(local.record_photos.map((row) => String(row.file_name)));
        stalePhotoFiles.push(...gone.map((row) => String(row.file_name)).filter((name) => !kept.has(name)));
      }
    }

    if (auto && local.works.length === 0 && stale.works.length > 0) {
      throw new Error('Refusing to empty the server copy from an empty phone');
    }

    for (const table of [...TABLES].reverse()) {
      for (let i = 0; i < stale[table].length; i += CHUNK) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('user_id', userId)
          .in('id', stale[table].slice(i, i + CHUNK));
        if (error) throw error;
      }
    }

    // Deleted photos leave Storage too
    if (stalePhotoFiles.length > 0) {
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .remove(stalePhotoFiles.map((name) => `${userId}/photos/${name}`));
      if (error) throw error;
      const uploaded = await readUploaded(userId);
      for (const name of stalePhotoFiles) uploaded.delete(name);
      await Storage.setItemAsync(uploadedKey(userId), JSON.stringify([...uploaded]));
    }

    const at = new Date().toISOString();
    await Storage.setItemAsync(lastSyncKey(userId), at);
    return at;
  });
}

// Whether this account already has records on the server
export async function hasRemoteData() {
  const { count, error } = await supabase.from('works').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return (count ?? 0) > 0;
}

// Replaces every local record with the server's copy, then fetches photos missing on this
// phone. Photos are best effort: a missing one doesn't undo or block the restore.
export function restoreFromBackup(db: SQLiteDatabase) {
  return serialized(async () => {
    const userId = await currentUserId();
    if (!userId) throw new Error('Not signed in');

    const fetched = {} as Tables;
    for (const table of TABLES) {
      fetched[table] = await fetchAllRemote(table, '*');
    }
    const remote = withoutOrphans(fetched);

    await db.withTransactionAsync(async () => {
      for (const table of [...TABLES].reverse()) {
        await db.runAsync(`DELETE FROM ${table}`);
      }
      for (const table of TABLES) {
        // Only columns this app version knows (drops user_id and anything newer)
        const known = new Set(
          (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name),
        );
        for (const row of remote[table]) {
          const columns = Object.keys(row).filter((c) => known.has(c));
          await db.runAsync(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
            ...columns.map((c) => row[c] as string | number | null),
          );
        }
      }
    });

    const dir = photoDir();
    const names = remote.record_photos.map((row) => String(row.file_name));
    const failedPhotos: string[] = [];
    for (const name of names) {
      if (photoFile(name).exists) continue;
      try {
        const { data, error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .createSignedUrl(`${userId}/photos/${name}`, 60);
        if (error) throw error;
        await File.downloadFileAsync(data.signedUrl, new File(dir, name));
      } catch (e) {
        console.warn('Photo restore failed', name, e);
        failedPhotos.push(name);
      }
    }
    // Everything that came back is already on the server
    await Storage.setItemAsync(
      uploadedKey(userId),
      JSON.stringify(names.filter((name) => !failedPhotos.includes(name))),
    );

    emitDataChanged();
    return { failedPhotos: failedPhotos.length };
  });
}
