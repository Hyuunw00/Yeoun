/// <reference types="jest" />

import { formatTripDates, fromDateString, toDateString, tripLength } from '@/lib/date';

describe('toDateString', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toDateString(new Date(2024, 10, 23))).toBe('2024-11-23');
  });

  it('zero-pads single-digit months and days', () => {
    expect(toDateString(new Date(2024, 0, 5))).toBe('2024-01-05');
  });

  it('uses the local calendar date, not UTC, near midnight', () => {
    expect(toDateString(new Date(2024, 11, 31, 23, 59, 59))).toBe('2024-12-31');
    expect(toDateString(new Date(2025, 0, 1, 0, 0, 1))).toBe('2025-01-01');
  });
});

describe('fromDateString', () => {
  it('parses into local midnight of that date', () => {
    const date = fromDateString('2024-03-09');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(9);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it.each(['2024-01-01', '2024-02-29', '2023-12-31', '1999-07-04'])(
    'round-trips %s through toDateString',
    (value) => {
      expect(toDateString(fromDateString(value))).toBe(value);
    },
  );

  it('yields an invalid date for malformed input', () => {
    expect(Number.isNaN(fromDateString('not-a-date').getTime())).toBe(true);
  });
});

describe('tripLength', () => {
  it('counts nights and days, inclusive of both ends', () => {
    expect(tripLength('2026-09-01', '2026-09-03')).toBe('2박 3일');
    expect(tripLength('2026-12-31', '2027-01-01')).toBe('1박 2일');
  });

  it('is null for a single day or an end not after the start', () => {
    expect(tripLength('2026-09-01', null)).toBeNull();
    expect(tripLength('2026-09-01', '2026-09-01')).toBeNull();
    expect(tripLength('2026-09-05', '2026-09-01')).toBeNull();
  });
});

describe('formatTripDates', () => {
  it('shows a single day as one date', () => {
    expect(formatTripDates('2026-09-01', null)).toBe('2026.09.01');
    expect(formatTripDates('2026-09-01', '2026-09-01')).toBe('2026.09.01');
  });

  it('drops the repeated year from the end of a trip', () => {
    expect(formatTripDates('2026-09-01', '2026-09-05')).toBe('2026.09.01 – 09.05');
  });

  it('keeps the year when the trip crosses into the next', () => {
    expect(formatTripDates('2026-12-30', '2027-01-02')).toBe('2026.12.30 – 2027.01.02');
  });
});
