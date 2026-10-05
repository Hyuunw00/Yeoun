/// <reference types="jest" />

import { distanceKm, groupTrips, type GeoPhoto } from '@/lib/photo-trips';

jest.mock('expo-media-library', () => ({}));
jest.mock('expo-location', () => ({}));

const seoul = { latitude: 37.5665, longitude: 126.978 };
const busan = { latitude: 35.1796, longitude: 129.0756 };
const gyeongju = { latitude: 35.8562, longitude: 129.2247 };

const HOUR = 60 * 60 * 1000;
// Local noon on 2026-09-01
const DAY1 = new Date(2026, 8, 1, 12).getTime();

let n = 0;
const photo = (place: { latitude: number; longitude: number }, time: number): GeoPhoto => ({
  id: `p${n++}`,
  time,
  ...place,
});

describe('distanceKm', () => {
  it('measures Seoul to Busan at about 325 km', () => {
    expect(distanceKm(seoul, busan)).toBeGreaterThan(310);
    expect(distanceKm(seoul, busan)).toBeLessThan(340);
  });
});

describe('groupTrips', () => {
  it('leaves out photos taken at home', () => {
    expect(groupTrips([photo(seoul, DAY1), photo(seoul, DAY1 + HOUR), photo(seoul, DAY1 + 2 * HOUR)], seoul)).toEqual(
      [],
    );
  });

  it('turns photos in one place over a few days into one trip with its dates', () => {
    const photos = [photo(busan, DAY1), photo(busan, DAY1 + 20 * HOUR), photo(busan, DAY1 + 50 * HOUR)];
    const [trip] = groupTrips(photos, seoul);
    expect(trip).toMatchObject({ start: '2026-09-01', end: '2026-09-03', photoIds: photos.map((p) => p.id) });
  });

  it('splits two cities on the same trip', () => {
    const photos = [
      photo(busan, DAY1),
      photo(busan, DAY1 + HOUR),
      photo(busan, DAY1 + 2 * HOUR),
      photo(gyeongju, DAY1 + 24 * HOUR),
      photo(gyeongju, DAY1 + 25 * HOUR),
      photo(gyeongju, DAY1 + 26 * HOUR),
    ];
    expect(groupTrips(photos, seoul)).toHaveLength(2);
  });

  it('splits visits to the same city far apart in time', () => {
    const later = DAY1 + 30 * 24 * HOUR;
    const photos = [
      photo(busan, DAY1),
      photo(busan, DAY1 + HOUR),
      photo(busan, DAY1 + 2 * HOUR),
      photo(busan, later),
      photo(busan, later + HOUR),
      photo(busan, later + 2 * HOUR),
    ];
    const trips = groupTrips(photos, seoul);
    expect(trips.map((t) => t.start)).toEqual(['2026-10-01', '2026-09-01']);
  });

  it('skips places with only a couple of photos', () => {
    expect(groupTrips([photo(busan, DAY1), photo(busan, DAY1 + HOUR)], seoul)).toEqual([]);
  });
});
