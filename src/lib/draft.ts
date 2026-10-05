import Storage from 'expo-sqlite/kv-store';

import type { Category } from '@/lib/db';

export type Draft = {
  body: string;
  experiencedOn: string;
  episode?: string;
  rating?: number | null;
};

const key = (category: Category, externalId: string) => `draft:${category}:${externalId}`;

export async function loadDraft(category: Category, externalId: string) {
  const raw = await Storage.getItemAsync(key(category, externalId));
  return raw ? (JSON.parse(raw) as Draft) : null;
}

export function saveDraft(category: Category, externalId: string, draft: Draft) {
  return Storage.setItemAsync(key(category, externalId), JSON.stringify(draft));
}

export function clearDraft(category: Category, externalId: string) {
  return Storage.removeItemAsync(key(category, externalId));
}
