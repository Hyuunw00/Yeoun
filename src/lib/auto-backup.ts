import type { SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

import { backupNow, hasRemoteData, restoreFromBackup } from '@/lib/backup';
import { onDataChanged } from '@/lib/changes';
import { supabase } from '@/lib/supabase';

const DEBOUNCE_MS = 3000;
// The account whose server copy this phone's local data belongs to (one owner at a time)
const OWNER_KEY = 'backup:localOwner';
// Per-user flag from before the owner key existed
const legacyLinkedKey = (userId: string) => `backup:linked:${userId}`;

// "Linked" means this phone's local data belongs to this account's server copy, so
// automatic syncs may overwrite the server. A phone stays unlinked when:
// - the account already has records on the server (fresh phone): the user must choose
//   to restore or to overwrite, so an empty phone never wipes the server copy
// - the local data belongs to another account: syncing would copy one account's
//   records into the other, or wipe it
export async function isLinked(userId: string) {
  const owner = await Storage.getItemAsync(OWNER_KEY);
  if (owner) return owner === userId;
  if ((await Storage.getItemAsync(legacyLinkedKey(userId))) === 'true') {
    await Storage.setItemAsync(OWNER_KEY, userId);
    return true;
  }
  return false;
}

// Makes this account the owner of the local data, replacing any previous owner
export async function setLinked(userId: string) {
  await Storage.setItemAsync(OWNER_KEY, userId);
}

async function hasOtherOwner(userId: string) {
  const owner = await Storage.getItemAsync(OWNER_KEY);
  return !!owner && owner !== userId;
}

async function signedInUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// Link automatically only when nothing can be lost: no other owner locally, no data on the server
export async function linkOnSignIn(db: SQLiteDatabase) {
  const userId = await signedInUserId();
  if (!userId || (await isLinked(userId))) return;
  if (await hasOtherOwner(userId)) return;
  if (await hasRemoteData()) return;
  await backupNow(db);
  await setLinked(userId);
}

export async function restoreAndLink(db: SQLiteDatabase) {
  const userId = await signedInUserId();
  if (!userId) throw new Error('Not signed in');
  const result = await restoreFromBackup(db);
  await setLinked(userId);
  return result;
}

export async function overwriteBackupAndLink(db: SQLiteDatabase) {
  const userId = await signedInUserId();
  if (!userId) throw new Error('Not signed in');
  await backupNow(db);
  await setLinked(userId);
}

// Syncs a few seconds after local changes settle, on launch and when the app comes back,
// while signed in and linked. backupNow itself is serialized, so overlaps are safe.
export function startAutoBackup(db: SQLiteDatabase) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = async () => {
    const userId = await signedInUserId();
    if (!userId) return;
    if (!(await isLinked(userId))) {
      // Retries a first link that failed earlier (e.g. offline right after signing in)
      await linkOnSignIn(db);
      return;
    }
    await backupNow(db, { auto: true });
  };

  const runSafely = (label: string) => run().catch((e) => console.warn(label, e));

  const unsubscribe = onDataChanged(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => runSafely('Auto sync failed'), DEBOUNCE_MS);
  });

  // Catch up on anything written while offline or before this launch
  runSafely('Startup sync failed');

  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') runSafely('Resume sync failed');
  });

  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
      linkOnSignIn(db).catch((e) => console.warn('Initial sync failed', e));
    }
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
    appState.remove();
    data.subscription.unsubscribe();
  };
}
