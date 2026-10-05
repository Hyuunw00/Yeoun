/// <reference types="jest" />

import type { LocationGeocodedAddress } from 'expo-location';

import { cityFromAddress, geocodeQueries, toSuggestion } from '@/lib/places';

function address(fields: Partial<LocationGeocodedAddress>): LocationGeocodedAddress {
  return {
    city: null,
    district: null,
    streetNumber: null,
    street: null,
    region: null,
    subregion: null,
    country: null,
    postalCode: null,
    name: null,
    isoCountryCode: null,
    timezone: null,
    formattedAddress: null,
    ...fields,
  };
}

const coords = { latitude: 1, longitude: 2 };

const en = (name: string) => ({ en: { name } });

describe('toSuggestion', () => {
  it('reads Korean names, the upper-cased country code and English translations', () => {
    expect(
      toSuggestion({
        properties: {
          mapbox_id: 'abc',
          name: '후쿠오카시',
          context: {
            place: { name: '후쿠오카시', translations: en('Fukuoka') },
            region: { name: '후쿠오카현', translations: en('Fukuoka') },
            country: { name: '일본', country_code: 'jp', translations: en('Japan') },
          },
        },
      }),
    ).toEqual({
      id: 'abc',
      name: '후쿠오카시',
      region: '후쿠오카현',
      country: '일본',
      countryCode: 'JP',
      english: { name: 'Fukuoka', region: 'Fukuoka', country: 'Japan' },
    });
  });

  it('leaves missing context empty and falls back to the shown name', () => {
    expect(toSuggestion({ properties: { mapbox_id: 'x', name: 'Somewhere' } })).toEqual({
      id: 'x',
      name: 'Somewhere',
      region: null,
      country: null,
      countryCode: null,
      english: { name: 'Somewhere', region: null, country: null },
    });
  });
});

describe('geocodeQueries', () => {
  it('tries Korean first, then English with and without the region', () => {
    expect(
      geocodeQueries({
        id: 'abc',
        name: '후쿠오카시',
        region: '후쿠오카현',
        country: '일본',
        countryCode: 'JP',
        english: { name: 'Fukuoka', region: 'Fukuoka', country: 'Japan' },
      }),
    ).toEqual(['후쿠오카시, 후쿠오카현, 일본', 'Fukuoka, Fukuoka, Japan', 'Fukuoka, Japan']);
  });

  it('drops duplicate queries', () => {
    expect(
      geocodeQueries({
        id: 'x',
        name: 'Banff',
        region: null,
        country: null,
        countryCode: null,
        english: { name: 'Banff', region: null, country: null },
      }),
    ).toEqual(['Banff']);
  });
});

describe('cityFromAddress', () => {
  it('uses the city and keeps the region when it differs', () => {
    const city = cityFromAddress(
      '광주시',
      coords,
      address({
        city: '광주시',
        region: '경기도',
        country: '대한민국',
        isoCountryCode: 'KR',
      }),
    );
    expect(city).toEqual({
      externalId: 'city:KR:경기도:광주시',
      name: '광주시',
      region: '경기도',
      country: '대한민국',
      countryCode: 'KR',
      latitude: 1,
      longitude: 2,
    });
  });

  it('drops the region when it is the city itself', () => {
    const city = cityFromAddress(
      '광주광역시',
      coords,
      address({
        city: '광주광역시',
        region: '광주광역시',
        country: '대한민국',
        isoCountryCode: 'KR',
      }),
    );
    expect(city?.region).toBeNull();
    expect(city?.externalId).toBe('city:KR::광주광역시');
  });

  it('prefers the name matching the pick when the center falls in a ward', () => {
    const city = cityFromAddress(
      '도쿄 도',
      coords,
      address({
        city: '지요다구',
        region: '도쿄',
        country: '일본',
        isoCountryCode: 'JP',
      }),
    );
    expect(city?.name).toBe('도쿄');
  });

  it('falls back to the city when nothing matches the pick', () => {
    const city = cityFromAddress(
      '밴프',
      coords,
      address({ city: 'Banff', region: '스코틀랜드', isoCountryCode: 'GB' }),
    );
    expect(city?.name).toBe('Banff');
  });

  it('renames countries whose Korean name reads oddly', () => {
    const city = cityFromAddress(
      '밴쿠버',
      coords,
      address({
        city: '밴쿠버',
        region: 'WA',
        country: '미 합중국',
        isoCountryCode: 'US',
      }),
    );
    expect(city?.country).toBe('미국');
  });

  it('returns null without any usable name', () => {
    expect(cityFromAddress('어딘가', coords, address({}))).toBeNull();
  });
});
