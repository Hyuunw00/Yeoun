import * as Location from 'expo-location';
import { AssetField, MediaType, Query, Asset } from 'expo-media-library';

import { toDateString } from '@/lib/date';
import { cityFromAddress, type City } from '@/lib/places';

// Finding past trips in the photo library: photos taken far from home are grouped into
// trips by time, then into cities by distance, and each city gets a name from the iOS
// geocoder. Nothing is saved until the user picks trips and photos to bring in.

// Closer to home than this counts as being at home
const AWAY_KM = 50;
// A longer gap between photos away from home starts a new trip
const TRIP_GAP_MS = 36 * 60 * 60 * 1000;
// Photos within this distance of a city's first photo belong to that city
const CITY_RADIUS_KM = 40;
// Fewer photos than this in one place is passing through, not a visit
const MIN_PHOTOS = 3;
const PAGE = 500;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const LOCATION_CONCURRENCY = 8;

export type GeoPhoto = { id: string; time: number; latitude: number; longitude: number };

export type PhotoTrip = {
  key: string;
  latitude: number;
  longitude: number;
  start: string; // YYYY-MM-DD
  end: string;
  // Asset ids, oldest first
  photoIds: string[];
};

type LatLng = { latitude: number; longitude: number };

export function distanceKm(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Pure grouping, so it can be tested without a photo library
export function groupTrips(photos: GeoPhoto[], home: LatLng): PhotoTrip[] {
  const away = photos.filter((p) => distanceKm(p, home) >= AWAY_KM).sort((a, b) => a.time - b.time);

  // Consecutive photos away from home, split where too much time passes between them
  const trips: GeoPhoto[][] = [];
  for (const photo of away) {
    const current = trips.at(-1);
    if (current && photo.time - current.at(-1)!.time <= TRIP_GAP_MS) current.push(photo);
    else trips.push([photo]);
  }

  // Within a trip, each city collects the photos near where it was first seen
  const cities: PhotoTrip[] = [];
  for (const trip of trips) {
    const groups: GeoPhoto[][] = [];
    for (const photo of trip) {
      const group = groups.find((g) => distanceKm(g[0], photo) < CITY_RADIUS_KM);
      if (group) group.push(photo);
      else groups.push([photo]);
    }
    for (const group of groups) {
      if (group.length < MIN_PHOTOS) continue;
      const first = group[0];
      cities.push({
        key: `${first.id}`,
        latitude: group.reduce((sum, p) => sum + p.latitude, 0) / group.length,
        longitude: group.reduce((sum, p) => sum + p.longitude, 0) / group.length,
        start: toDateString(new Date(first.time)),
        end: toDateString(new Date(group.at(-1)!.time)),
        photoIds: group.map((p) => p.id),
      });
    }
  }
  // Newest first, like the rest of the app
  return cities.sort((a, b) => b.start.localeCompare(a.start));
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Reads time and place of every photo from the last `years` (all when null). Location is
// read per photo, which is the slow part; `onProgress` reports photos read out of the total.
export async function scanPhotos(years: number | null, onProgress: (done: number, total: number) => void) {
  const since = years ? Date.now() - years * YEAR_MS : 0;
  const metadata = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .gte(AssetField.CREATION_TIME, since)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: true })
      .limit(PAGE)
      .offset(offset)
      .exeForMetadata();
    metadata.push(...page);
    if (page.length < PAGE) break;
  }

  let done = 0;
  const located = await mapLimited(metadata, LOCATION_CONCURRENCY, async (m) => {
    const location = m.creationTime ? await new Asset(m.id).getLocation().catch(() => null) : null;
    done++;
    if (done % 50 === 0 || done === metadata.length) onProgress(done, metadata.length);
    return location && m.creationTime
      ? { id: m.id, time: m.creationTime, latitude: location.latitude, longitude: location.longitude }
      : null;
  });
  return located.filter((p): p is GeoPhoto => p !== null);
}

// Names a found trip's city with the iOS geocoder, the same way search does
export async function nameTrip(trip: PhotoTrip): Promise<City | null> {
  const coords = { latitude: trip.latitude, longitude: trip.longitude };
  const [address] = await Location.reverseGeocodeAsync(coords);
  if (!address) return null;
  return cityFromAddress(address.city ?? address.region ?? '', coords, address);
}
