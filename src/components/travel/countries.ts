import data from './data/countries.json';

// Detailed home-country maps with provinces, pre-projected by scripts/build-country-maps.py
type CountryData = {
  meta: {
    name: string;
    minLongitude: number;
    maxLatitude: number;
    cos: number;
    unitsPerDegree: number;
    width: number;
    height: number;
  };
  regions: { name: string; path: string }[];
};

const COUNTRIES = data as Record<string, CountryData>;

// Korea when home is unset or in a country without a detailed map
export const DEFAULT_COUNTRY = 'KR';

export function countryMap(code: string | null | undefined) {
  return (code && COUNTRIES[code]) || null;
}

// Matching the build script's per-country projection
export function projectIn(country: CountryData, latitude: number, longitude: number) {
  const { minLongitude, maxLatitude, cos, unitsPerDegree } = country.meta;
  return { x: (longitude - minLongitude) * cos * unitsPerDegree, y: (maxLatitude - latitude) * unitsPerDegree };
}

export type { CountryData };

// 🇰🇷 from "KR"
export function flag(code: string) {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
