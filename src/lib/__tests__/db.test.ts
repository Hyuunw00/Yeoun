/// <reference types="jest" />

import type { SQLiteDatabase } from 'expo-sqlite';

import { deleteRecord, listWorks, migrate, updateRecord } from '@/lib/db';
import { deletePhotoFiles } from '@/lib/photos';

// photos.ts pulls in native expo modules; only the file cleanup hook matters here
jest.mock('@/lib/photos', () => ({ deletePhotoFiles: jest.fn() }));

// Minimal stand-in for the expo-sqlite connection, recording every call.
// Exclusive transactions get their own fake connection, like expo-sqlite does.
function createFakeDb() {
  const tx = {
    execAsync: jest.fn().mockResolvedValue(undefined),
  };
  const db = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
    withExclusiveTransactionAsync: jest.fn(async (task: (txn: typeof tx) => Promise<void>) => task(tx)),
  };
  return { db, tx, sqlite: db as unknown as SQLiteDatabase };
}

// Collapses whitespace so assertions can match multi-line SQL loosely
const sqlOf = (mock: jest.Mock) => mock.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());

const CONNECTION_PRAGMAS = ['PRAGMA journal_mode = WAL', 'PRAGMA foreign_keys = ON'];

beforeEach(() => {
  jest.mocked(deletePhotoFiles).mockClear();
});

describe('migrate', () => {
  it('sets connection pragmas outside any transaction', async () => {
    const { db, sqlite } = createFakeDb();
    db.getFirstAsync.mockResolvedValueOnce({ user_version: 9 });

    await migrate(sqlite);

    expect(sqlOf(db.execAsync)).toEqual(CONNECTION_PRAGMAS);
  });

  it('runs every step from user_version 0, each in its own transaction with its version bump', async () => {
    const { db, tx, sqlite } = createFakeDb();
    db.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });

    await migrate(sqlite);

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(9);
    const sql = sqlOf(tx.execAsync);
    expect(sql).toHaveLength(18);
    expect(sql[0]).toContain('CREATE TABLE works');
    expect(sql[0]).toContain('CREATE TABLE records');
    expect(sql[1]).toBe('PRAGMA user_version = 1');
    expect(sql[2]).toBe('ALTER TABLE records ADD COLUMN episode TEXT');
    expect(sql[3]).toBe('PRAGMA user_version = 2');
    expect(sql[4]).toBe('ALTER TABLE records ADD COLUMN rating REAL');
    expect(sql[5]).toBe('PRAGMA user_version = 3');
    expect(sql[6]).toBe('ALTER TABLE works ADD COLUMN release_date TEXT');
    expect(sql[7]).toBe('PRAGMA user_version = 4');
    expect(sql[8]).toContain('CREATE TABLE record_photos');
    expect(sql[9]).toBe('PRAGMA user_version = 5');
    expect(sql[10]).toContain('CREATE TABLE record_quotes');
    expect(sql[11]).toBe('PRAGMA user_version = 6');
    expect(sql[12]).toContain('ADD COLUMN backdrop_url');
    expect(sql[12]).toContain('ADD COLUMN credits');
    expect(sql[13]).toBe('PRAGMA user_version = 7');
    expect(sql[14]).toContain('ADD COLUMN track');
    expect(sql[15]).toBe('PRAGMA user_version = 8');
    expect(sql[16]).toBe('ALTER TABLE works ADD COLUMN format TEXT');
    expect(sql[17]).toBe('PRAGMA user_version = 9');
  });

  it('treats a missing user_version row as version 0', async () => {
    const { db, tx, sqlite } = createFakeDb();
    db.getFirstAsync.mockResolvedValueOnce(null);

    await migrate(sqlite);

    expect(sqlOf(tx.execAsync)[0]).toContain('CREATE TABLE works');
    expect(sqlOf(tx.execAsync).at(-1)).toBe('PRAGMA user_version = 9');
  });

  it('only runs the remaining steps from an intermediate version', async () => {
    const { db, tx, sqlite } = createFakeDb();
    db.getFirstAsync.mockResolvedValueOnce({ user_version: 3 });

    await migrate(sqlite);

    expect(sqlOf(tx.execAsync)).toEqual([
      'ALTER TABLE works ADD COLUMN release_date TEXT',
      'PRAGMA user_version = 4',
      expect.stringContaining('CREATE TABLE record_photos'),
      'PRAGMA user_version = 5',
      expect.stringContaining('CREATE TABLE record_quotes'),
      'PRAGMA user_version = 6',
      expect.stringContaining('ADD COLUMN backdrop_url'),
      'PRAGMA user_version = 7',
      expect.stringContaining('ADD COLUMN track'),
      'PRAGMA user_version = 8',
      'ALTER TABLE works ADD COLUMN format TEXT',
      'PRAGMA user_version = 9',
    ]);
  });

  it('stops at the failed step so the next launch resumes from there', async () => {
    const { db, tx, sqlite } = createFakeDb();
    db.getFirstAsync.mockResolvedValueOnce({ user_version: 2 });
    // Step 3 commits; step 4's schema change fails
    tx.execAsync
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('disk I/O error'));

    await expect(migrate(sqlite)).rejects.toThrow('disk I/O error');

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(2);
    expect(sqlOf(tx.execAsync)).not.toContain('PRAGMA user_version = 4');
  });

  it('does not run any step when already at or above the latest version', async () => {
    for (const version of [9, 12]) {
      const { db, sqlite } = createFakeDb();
      db.getFirstAsync.mockResolvedValueOnce({ user_version: version });

      await migrate(sqlite);

      expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
    }
  });
});

describe('listWorks', () => {
  function argsOf(db: ReturnType<typeof createFakeDb>['db']) {
    const [, ...args] = db.getAllAsync.mock.calls[0];
    return args;
  }

  it('escapes LIKE wildcards in the query', async () => {
    const { db, sqlite } = createFakeDb();

    await listWorks(sqlite, 'movie', '100%');

    expect(argsOf(db)).toEqual(['movie', '100%', ...Array(5).fill('%100\\%%')]);
  });

  it('escapes underscores and backslashes too', async () => {
    const { db, sqlite } = createFakeDb();

    await listWorks(sqlite, 'book', 'a_b\\c');

    expect(argsOf(db)[2]).toBe('%a\\_b\\\\c%');
  });

  it('trims the query before matching', async () => {
    const { db, sqlite } = createFakeDb();

    await listWorks(sqlite, 'music', '  jazz  ');

    expect(argsOf(db)).toEqual(['music', 'jazz', ...Array(5).fill('%jazz%')]);
  });

  it('passes an empty query through so every work matches', async () => {
    const { db, sqlite } = createFakeDb();

    await listWorks(sqlite, 'travel');

    expect(argsOf(db)).toEqual(['travel', '', ...Array(5).fill('%%')]);
  });

  it('declares the backslash escape character in SQL', async () => {
    const { db, sqlite } = createFakeDb();

    await listWorks(sqlite, 'movie', 'x');

    expect(sqlOf(db.getAllAsync)[0]).toContain("LIKE ? ESCAPE '\\'");
  });

  it('returns the rows from the database', async () => {
    const { db, sqlite } = createFakeDb();
    const rows = [{ id: 1, title: 'A' }];
    db.getAllAsync.mockResolvedValueOnce(rows);

    await expect(listWorks(sqlite, 'movie')).resolves.toBe(rows);
  });
});

describe('photo file cleanup', () => {
  it('updateRecord deletes only photos that were removed from the record', async () => {
    const { db, sqlite } = createFakeDb();
    db.getAllAsync.mockResolvedValueOnce([{ fileName: 'a.jpg' }, { fileName: 'b.jpg' }]);

    await updateRecord(
      sqlite,
      7,
      { body: 'note', experiencedOn: '2024-01-01', episode: null, rating: 4.5 },
      ['b.jpg', 'c.jpg'],
    );

    expect(deletePhotoFiles).toHaveBeenCalledWith(['a.jpg']);
    // New photo list is re-inserted in order
    const inserts = db.runAsync.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT INTO record_photos'));
    expect(inserts.map(([, ...args]) => args)).toEqual([
      [7, 'b.jpg', 0],
      [7, 'c.jpg', 1],
    ]);
  });

  it('deleteRecord reports work removal and deletes the record photos', async () => {
    const { db, sqlite } = createFakeDb();
    db.getAllAsync.mockResolvedValueOnce([{ fileName: 'a.jpg' }]);
    db.getFirstAsync.mockResolvedValueOnce({ workId: 3 });
    db.runAsync
      .mockResolvedValueOnce({ lastInsertRowId: 0, changes: 1 })
      .mockResolvedValueOnce({ lastInsertRowId: 0, changes: 1 });

    await expect(deleteRecord(sqlite, 9)).resolves.toBe(true);
    expect(deletePhotoFiles).toHaveBeenCalledWith(['a.jpg']);
  });

  it('deleteRecord keeps the work when other records remain', async () => {
    const { db, sqlite } = createFakeDb();
    db.getFirstAsync.mockResolvedValueOnce({ workId: 3 });
    db.runAsync
      .mockResolvedValueOnce({ lastInsertRowId: 0, changes: 1 })
      .mockResolvedValueOnce({ lastInsertRowId: 0, changes: 0 });

    await expect(deleteRecord(sqlite, 9)).resolves.toBe(false);
  });

  it('deleteRecord is a no-op for an unknown record', async () => {
    const { db, sqlite } = createFakeDb();

    await expect(deleteRecord(sqlite, 404)).resolves.toBe(false);
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(deletePhotoFiles).toHaveBeenCalledWith([]);
  });
});
