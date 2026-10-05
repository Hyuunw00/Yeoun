// iTunes Search API: no key needed. The Korean storefront returns no music,
// so this uses the default (US) store, which still finds Korean queries but
// often returns romanized artist and album names.
const BASE_URL = 'https://itunes.apple.com/search';
const ARTWORK_SIZE = 600;

// How the album was released; singles press as small 7" records in the shop
export type ReleaseFormat = 'single' | 'ep' | 'album';

export function releaseFormat(collectionName: string, trackCount: number | undefined): ReleaseFormat {
  if (/ - Single$/i.test(collectionName)) return 'single';
  if (/ - EP$/i.test(collectionName)) return 'ep';
  if (trackCount !== undefined && trackCount <= 3) return 'single';
  if (trackCount !== undefined && trackCount <= 6) return 'ep';
  return 'album';
}

export type MusicResult = {
  kind: 'album' | 'song';
  format: ReleaseFormat;
  // The album is the unit stored on the shelf, whether an album or a song was picked
  externalId: string;
  albumTitle: string;
  artist: string;
  trackName: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  artworkUrl: string | null;
};

type ItunesResult = {
  wrapperType: 'collection' | 'track';
  collectionId: number;
  collectionName: string;
  artistName: string;
  trackName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  trackCount?: number;
};

// Artwork URLs end in "100x100bb.jpg"; the same path serves larger sizes
export function largeArtwork(url: string | undefined) {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\./, `/${ARTWORK_SIZE}x${ARTWORK_SIZE}bb.`);
}

export function albumExternalId(collectionId: number) {
  return `itunes:${collectionId}`;
}

function toResult(r: ItunesResult): MusicResult {
  return {
    kind: r.wrapperType === 'track' ? 'song' : 'album',
    format: releaseFormat(r.collectionName, r.trackCount),
    externalId: albumExternalId(r.collectionId),
    albumTitle: r.collectionName,
    artist: r.artistName,
    trackName: r.wrapperType === 'track' ? (r.trackName ?? null) : null,
    releaseDate: r.releaseDate ? r.releaseDate.slice(0, 10) : null,
    artworkUrl: largeArtwork(r.artworkUrl100),
  };
}

async function search(query: string, entity: 'album' | 'song', signal?: AbortSignal) {
  const params = new URLSearchParams({ term: query, media: 'music', entity, limit: '15' });
  const res = await fetch(`${BASE_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = (await res.json()) as { results: ItunesResult[] };
  return data.results.filter((r) => r.collectionId).map(toResult);
}

export type MusicFilter = 'all' | 'album' | 'song';

// Albums first, then songs; a filter fetches only that kind
export async function searchMusic(query: string, filter: MusicFilter = 'all', signal?: AbortSignal) {
  if (filter !== 'all') return search(query, filter, signal);
  const [albums, songs] = await Promise.all([search(query, 'album', signal), search(query, 'song', signal)]);
  return [...albums, ...songs];
}

export type AlbumTrack = {
  number: number;
  name: string;
  previewUrl: string | null;
  durationMs: number | null;
};

type LookupResult = {
  wrapperType: 'collection' | 'track';
  trackNumber?: number;
  trackName?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  collectionName?: string;
  trackCount?: number;
  collectionViewUrl?: string;
};

// Album tracks with their 30-second previews, and the album's Apple Music page
export async function getAlbumTracks(externalId: string, signal?: AbortSignal) {
  const collectionId = externalId.replace(/^itunes:/, '');
  const res = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=song`, { signal });
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = (await res.json()) as { results: LookupResult[] };
  const album = data.results.find((r) => r.wrapperType === 'collection');
  const tracks: AlbumTrack[] = data.results
    .filter((r) => r.wrapperType === 'track' && r.trackName)
    .map((r) => ({
      number: r.trackNumber ?? 0,
      name: r.trackName!,
      previewUrl: r.previewUrl ?? null,
      durationMs: r.trackTimeMillis ?? null,
    }))
    .sort((a, b) => a.number - b.number);
  // Same album on the Korean storefront
  const appleMusicUrl = album?.collectionViewUrl?.replace('/us/', '/kr/') ?? null;
  const format = album ? releaseFormat(album.collectionName ?? '', album.trackCount ?? tracks.length) : null;
  return { tracks, appleMusicUrl, format };
}

const normalize = (s: string) => s.toLowerCase().replace(/\(.*?\)|\s/g, '');

// The album track matching a name typed in a record ("Palette" ↔ "Palette (feat. G-DRAGON)")
export function findTrack(tracks: AlbumTrack[], name: string | null) {
  if (!name) return null;
  const target = normalize(name);
  if (!target) return null;
  return tracks.find((t) => normalize(t.name) === target) ??
    tracks.find((t) => normalize(t.name).includes(target) || target.includes(normalize(t.name))) ??
    null;
}

export type ListenLink = { label: string; url: string };

// Where to hear the full song or album; the app opens if installed, otherwise the web
export function listenLinks(query: string, appleMusicUrl: string | null): ListenLink[] {
  const q = encodeURIComponent(query);
  return [
    { label: 'Apple Music', url: appleMusicUrl ?? `https://music.apple.com/kr/search?term=${q}` },
    { label: 'YouTube Music', url: `https://music.youtube.com/search?q=${q}` },
    { label: 'Spotify', url: `https://open.spotify.com/search/${q}` },
    { label: '멜론', url: `https://m.app.melon.com/search/searchMcom.htm?s=${q}` },
  ];
}

export function formatDuration(ms: number | null) {
  if (!ms) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
