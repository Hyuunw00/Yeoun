const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const TOKEN = process.env.EXPO_PUBLIC_TMDB_TOKEN;

export type MediaType = 'movie' | 'tv';

export type TmdbTitle = {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  releaseDate: string;
  posterPath: string | null;
};

type TmdbMovieResponse = {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
};

type TmdbTvResponse = {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string;
  poster_path: string | null;
};

type TmdbMultiResponse =
  | (TmdbMovieResponse & { media_type: 'movie' })
  | (TmdbTvResponse & { media_type: 'tv' })
  | { media_type: 'person' };

async function request<T>(path: string, params: Record<string, string>, signal?: AbortSignal) {
  const query = new URLSearchParams({ language: 'ko-KR', ...params }).toString();
  const res = await fetch(`${BASE_URL}${path}?${query}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    signal,
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

function fromMovie(m: TmdbMovieResponse): TmdbTitle {
  return {
    id: m.id,
    mediaType: 'movie',
    title: m.title,
    originalTitle: m.original_title,
    releaseDate: m.release_date,
    posterPath: m.poster_path,
  };
}

function fromTv(t: TmdbTvResponse): TmdbTitle {
  return {
    id: t.id,
    mediaType: 'tv',
    title: t.name,
    originalTitle: t.original_name,
    releaseDate: t.first_air_date,
    posterPath: t.poster_path,
  };
}

// Movies and TV shows in one list, people excluded
export async function searchTitles(query: string, signal?: AbortSignal) {
  const data = await request<{ results: TmdbMultiResponse[] }>(
    '/search/multi',
    { query, include_adult: 'false' },
    signal,
  );
  return data.results.flatMap((r) => {
    if (r.media_type === 'movie') return [fromMovie(r)];
    if (r.media_type === 'tv') return [fromTv(r)];
    return [];
  });
}

export async function getTitle(mediaType: MediaType, id: number, signal?: AbortSignal) {
  return mediaType === 'movie'
    ? fromMovie(await request<TmdbMovieResponse>(`/movie/${id}`, {}, signal))
    : fromTv(await request<TmdbTvResponse>(`/tv/${id}`, {}, signal));
}

// Movie and TV ids are separate namespaces in TMDB, so TV ids get a prefix.
// Movies stay as the bare id to keep records saved before TV support valid.
export function toExternalId(title: Pick<TmdbTitle, 'mediaType' | 'id'>) {
  return title.mediaType === 'tv' ? `tv:${title.id}` : String(title.id);
}

export function parseExternalId(externalId: string): { mediaType: MediaType; id: number } {
  return externalId.startsWith('tv:')
    ? { mediaType: 'tv', id: Number(externalId.slice(3)) }
    : { mediaType: 'movie', id: Number(externalId) };
}

export function isSeries(externalId: string) {
  return parseExternalId(externalId).mediaType === 'tv';
}

export type Credits = {
  // Directors for a movie, creators for a series
  directors: string[];
  cast: { name: string; character: string }[];
};

export type TitleDetails = {
  releaseDate: string | null;
  backdropPath: string | null;
  credits: Credits;
};

const CAST_LIMIT = 8;

type DetailsResponse = {
  release_date?: string;
  first_air_date?: string;
  backdrop_path: string | null;
  created_by?: { name: string }[];
  credits: {
    cast: { name: string; character: string }[];
    crew: { name: string; job: string }[];
  };
};

// Release date, wide still and the people behind it, in one request
export async function getTitleDetails(mediaType: MediaType, id: number, signal?: AbortSignal): Promise<TitleDetails> {
  const data = await request<DetailsResponse>(`/${mediaType}/${id}`, { append_to_response: 'credits' }, signal);
  const directors =
    mediaType === 'movie'
      ? data.credits.crew.filter((c) => c.job === 'Director').map((c) => c.name)
      : (data.created_by ?? []).map((c) => c.name);
  return {
    releaseDate: (mediaType === 'movie' ? data.release_date : data.first_air_date) || null,
    backdropPath: data.backdrop_path,
    credits: {
      directors,
      cast: data.credits.cast.slice(0, CAST_LIMIT).map(({ name, character }) => ({ name, character })),
    },
  };
}

export function backdropUrl(path: string, size: 'w780' | 'w1280' = 'w1280') {
  return `${IMAGE_BASE_URL}/${size}${path}`;
}

export function posterUrl(path: string, size: 'w185' | 'w342' | 'w500' | 'original' = 'w185') {
  return `${IMAGE_BASE_URL}/${size}${path}`;
}
