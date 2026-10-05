/// <reference types="jest" />

import {
  getTitle,
  isSeries,
  parseExternalId,
  posterUrl,
  searchTitles,
  toExternalId,
} from '@/lib/tmdb';

describe('external ids', () => {
  it('keeps movie ids as bare numbers', () => {
    expect(toExternalId({ mediaType: 'movie', id: 123 })).toBe('123');
  });

  it('prefixes tv ids with "tv:"', () => {
    expect(toExternalId({ mediaType: 'tv', id: 123 })).toBe('tv:123');
  });

  it('parses bare ids as movies for backward compatibility', () => {
    expect(parseExternalId('123')).toEqual({ mediaType: 'movie', id: 123 });
  });

  it('parses "tv:" ids as tv', () => {
    expect(parseExternalId('tv:456')).toEqual({ mediaType: 'tv', id: 456 });
  });

  it.each([
    { mediaType: 'movie' as const, id: 1 },
    { mediaType: 'movie' as const, id: 98765 },
    { mediaType: 'tv' as const, id: 1 },
    { mediaType: 'tv' as const, id: 98765 },
  ])('round-trips $mediaType $id', (title) => {
    expect(parseExternalId(toExternalId(title))).toEqual(title);
  });

  it('isSeries is true only for tv ids', () => {
    expect(isSeries('tv:1')).toBe(true);
    expect(isSeries('1')).toBe(false);
  });
});

describe('posterUrl', () => {
  it('defaults to w185', () => {
    expect(posterUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w185/abc.jpg');
  });

  it('uses the requested size', () => {
    expect(posterUrl('/abc.jpg', 'original')).toBe('https://image.tmdb.org/t/p/original/abc.jpg');
  });
});

describe('TMDB requests', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  function respond(body: unknown, init: { ok?: boolean; status?: number } = {}) {
    fetchMock.mockResolvedValueOnce({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    });
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('searchTitles', () => {
    it('maps movie and tv results and drops people', async () => {
      respond({
        results: [
          {
            media_type: 'movie',
            id: 1,
            title: '기생충',
            original_title: 'Parasite',
            release_date: '2019-05-30',
            poster_path: '/m.jpg',
          },
          { media_type: 'person', id: 2, name: 'Bong Joon-ho' },
          {
            media_type: 'tv',
            id: 3,
            name: '오징어 게임',
            original_name: 'Squid Game',
            first_air_date: '2021-09-17',
            poster_path: null,
          },
        ],
      });

      await expect(searchTitles('봉')).resolves.toEqual([
        {
          id: 1,
          mediaType: 'movie',
          title: '기생충',
          originalTitle: 'Parasite',
          releaseDate: '2019-05-30',
          posterPath: '/m.jpg',
        },
        {
          id: 3,
          mediaType: 'tv',
          title: '오징어 게임',
          originalTitle: 'Squid Game',
          releaseDate: '2021-09-17',
          posterPath: null,
        },
      ]);
    });

    it('calls /search/multi with query, language and adult filter', async () => {
      respond({ results: [] });
      const controller = new AbortController();

      await searchTitles('a b&c', controller.signal);

      const [url, init] = fetchMock.mock.calls[0];
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://api.themoviedb.org/3/search/multi');
      expect(parsed.searchParams.get('query')).toBe('a b&c');
      expect(parsed.searchParams.get('language')).toBe('ko-KR');
      expect(parsed.searchParams.get('include_adult')).toBe('false');
      expect(init.signal).toBe(controller.signal);
      expect(init.headers.Authorization).toMatch(/^Bearer /);
    });

    it('returns an empty list when nothing matches', async () => {
      respond({ results: [] });
      await expect(searchTitles('zzz')).resolves.toEqual([]);
    });

    it('throws with the status on a non-OK response', async () => {
      respond({}, { ok: false, status: 401 });
      await expect(searchTitles('x')).rejects.toThrow('TMDB 401');
    });
  });

  describe('getTitle', () => {
    it('fetches and maps a movie', async () => {
      respond({
        id: 10,
        title: '제목',
        original_title: 'Title',
        release_date: '2020-01-01',
        poster_path: '/p.jpg',
      });

      await expect(getTitle('movie', 10)).resolves.toEqual({
        id: 10,
        mediaType: 'movie',
        title: '제목',
        originalTitle: 'Title',
        releaseDate: '2020-01-01',
        posterPath: '/p.jpg',
      });
      expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/3/movie/10');
    });

    it('fetches and maps a tv show using tv field names', async () => {
      respond({
        id: 20,
        name: '드라마',
        original_name: 'Drama',
        first_air_date: '2022-02-02',
        poster_path: null,
      });

      await expect(getTitle('tv', 20)).resolves.toEqual({
        id: 20,
        mediaType: 'tv',
        title: '드라마',
        originalTitle: 'Drama',
        releaseDate: '2022-02-02',
        posterPath: null,
      });
      expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/3/tv/20');
    });

    it('throws on a non-OK response', async () => {
      respond({}, { ok: false, status: 404 });
      await expect(getTitle('movie', 1)).rejects.toThrow('TMDB 404');
    });

    it('propagates network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('offline'));
      await expect(getTitle('tv', 1)).rejects.toThrow('offline');
    });
  });
});
