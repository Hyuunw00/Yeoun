import Storage from 'expo-sqlite/kv-store';

// The city trips leave from. Each record keeps a copy of it as its origin, so moving
// (e.g. Seoul → Vancouver) only changes routes drawn for trips after the move.
export type HomeCity = {
  name: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
};

const KEY = 'travel:home';

export async function loadHome(): Promise<HomeCity | null> {
  const raw = await Storage.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HomeCity;
  } catch {
    return null;
  }
}

export async function saveHome(home: HomeCity) {
  await Storage.setItemAsync(KEY, JSON.stringify(home));
}

// A record's stored origin; null when missing or malformed
export function parseOrigin(origin: string | null): HomeCity | null {
  if (!origin) return null;
  try {
    const parsed = JSON.parse(origin) as Partial<HomeCity>;
    return parsed.name && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number'
      ? (parsed as HomeCity)
      : null;
  } catch {
    return null;
  }
}
