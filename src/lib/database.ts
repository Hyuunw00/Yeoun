import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

// One connection for the app's lifetime. Kept on globalThis so Fast Refresh
// re-running this module reuses it instead of leaving screens with a closed handle.
const globalForDb = globalThis as typeof globalThis & { __yeounDb?: SQLiteDatabase };

export const database = (globalForDb.__yeounDb ??= openDatabaseSync('yeoun.db'));

export function useDb() {
  return database;
}
