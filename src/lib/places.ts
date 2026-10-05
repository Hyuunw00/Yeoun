import * as Location from 'expo-location';

// City search: Mapbox's free (temporary) geocoding suggests cities while typing, but its
// terms forbid storing those results. The picked city is resolved again with the iOS
// geocoder, and only that result is saved.
const SUGGEST_URL = 'https://api.mapbox.com/search/geocode/v6/forward';
const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

// Apple's Korean names that read oddly in the app
const COUNTRY_NAMES: Record<string, string> = { US: '미국' };

export type CitySuggestion = {
  id: string;
  name: string;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  // The same place in English. On devices the iOS geocoder often finds nothing for
  // Korean place names (e.g. "후쿠오카시") but does find the English ones.
  english: { name: string; region: string | null; country: string | null };
};

type Translated = { name: string; translations?: { en?: { name: string } } };

type MapboxFeature = {
  properties: {
    mapbox_id: string;
    name: string;
    context?: {
      place?: Translated;
      region?: Translated;
      country?: Translated & { country_code: string };
    };
  };
};

const english = (part: Translated | undefined) => part?.translations?.en?.name ?? part?.name ?? null;

export function toSuggestion(feature: MapboxFeature): CitySuggestion {
  const { mapbox_id, name, context } = feature.properties;
  return {
    id: mapbox_id,
    name,
    region: context?.region?.name ?? null,
    country: context?.country?.name ?? null,
    countryCode: context?.country?.country_code?.toUpperCase() ?? null,
    english: {
      name: english(context?.place) ?? name,
      region: english(context?.region),
      country: english(context?.country),
    },
  };
}

// Cities only (no districts or neighborhoods), so "강남" doesn't file Gangnam as a city
export async function suggestCities(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({
    q: query,
    types: 'place',
    // Korean to show, English as a fallback for the iOS geocoder
    language: 'ko,en',
    limit: '8',
    autocomplete: 'true',
    access_token: TOKEN,
  });
  const res = await fetch(`${SUGGEST_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Mapbox ${res.status}`);
  const data = (await res.json()) as { features: MapboxFeature[] };
  return data.features.map(toSuggestion);
}

export type City = {
  // Same city, same id, so a second trip adds a record to it
  externalId: string;
  name: string;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
};

const squash = (s: string) => s.replace(/\s/g, '');

// "도쿄 도" ↔ "도쿄", "밴쿠버" ↔ "밴쿠버"
function sameName(a: string, b: string) {
  const x = squash(a);
  const y = squash(b);
  return x.startsWith(y) || y.startsWith(x);
}

// The reverse-geocoded address of a city's center can name a ward (Tokyo → 지요다구),
// so prefer whichever of its names matches the city that was picked
export function cityFromAddress(
  pickedName: string,
  coords: { latitude: number; longitude: number },
  address: Location.LocationGeocodedAddress,
): City | null {
  const names = [address.city, address.region, address.subregion].filter((n): n is string => !!n);
  const name = names.find((n) => sameName(n, pickedName)) ?? address.city ?? address.region;
  if (!name) return null;
  const countryCode = address.isoCountryCode?.toUpperCase() ?? null;
  const region = address.region && address.region !== name ? address.region : null;
  return {
    externalId: `city:${countryCode ?? ''}:${region ?? ''}:${name}`,
    name,
    region,
    country: (countryCode && COUNTRY_NAMES[countryCode]) ?? address.country ?? null,
    countryCode,
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

const joined = (...parts: (string | null)[]) => parts.filter(Boolean).join(', ');

// Query shapes for the iOS geocoder, most specific first
export function geocodeQueries(suggestion: CitySuggestion) {
  const { name, region, country, english: en } = suggestion;
  const queries = [joined(name, region, country), joined(en.name, en.region, en.country), joined(en.name, en.country)];
  return [...new Set(queries)];
}

// Looks the picked suggestion up again with the iOS geocoder, whose results may be kept
export async function resolveCity(suggestion: CitySuggestion) {
  for (const query of geocodeQueries(suggestion)) {
    const [location] = await Location.geocodeAsync(query);
    if (!location) continue;
    const coords = { latitude: location.latitude, longitude: location.longitude };
    // Names come back in the phone's language, so Korean on a Korean phone
    const [address] = await Location.reverseGeocodeAsync(coords);
    if (!address) return null;
    return cityFromAddress(suggestion.name, coords, address);
  }
  return null;
}
