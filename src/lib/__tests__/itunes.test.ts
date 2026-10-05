/// <reference types="jest" />

import { albumExternalId, findTrack, formatDuration, releaseFormat, largeArtwork, listenLinks, type AlbumTrack } from '@/lib/itunes';

const tracks: AlbumTrack[] = [
  { number: 1, name: 'Dlwlrma', previewUrl: 'a', durationMs: null },
  { number: 2, name: 'Palette (feat. G-DRAGON)', previewUrl: 'b', durationMs: null },
  { number: 3, name: 'Ending Scene', previewUrl: 'c', durationMs: null },
];

describe('findTrack', () => {
  it('matches ignoring case, spaces and parenthesized credits', () => {
    expect(findTrack(tracks, 'palette')?.number).toBe(2);
    expect(findTrack(tracks, 'ending  scene')?.number).toBe(3);
  });

  it('matches a partial name', () => {
    expect(findTrack(tracks, 'Ending')?.number).toBe(3);
  });

  it('returns null for no name or no match', () => {
    expect(findTrack(tracks, null)).toBeNull();
    expect(findTrack(tracks, '   ')).toBeNull();
    expect(findTrack(tracks, '밤편지')).toBeNull();
  });
});

describe('largeArtwork', () => {
  it('swaps the 100px size for 600px', () => {
    expect(largeArtwork('https://x.mzstatic.com/image/thumb/a/100x100bb.jpg')).toBe(
      'https://x.mzstatic.com/image/thumb/a/600x600bb.jpg',
    );
    expect(largeArtwork(undefined)).toBeNull();
  });
});

describe('listenLinks', () => {
  it('uses the album page for Apple Music when known and URL-encodes the query elsewhere', () => {
    const links = listenLinks('아이유 Palette', 'https://music.apple.com/kr/album/palette/1');
    expect(links.map((l) => l.label)).toEqual(['Apple Music', 'YouTube Music', 'Spotify', '멜론']);
    expect(links[0].url).toBe('https://music.apple.com/kr/album/palette/1');
    expect(links[1].url).toContain(encodeURIComponent('아이유 Palette'));
  });

  it('falls back to Apple Music search without an album page', () => {
    expect(listenLinks('x', null)[0].url).toBe('https://music.apple.com/kr/search?term=x');
  });
});

it('albumExternalId prefixes the iTunes collection id', () => {
  expect(albumExternalId(1229073300)).toBe('itunes:1229073300');
});

it('formatDuration shows m:ss', () => {
  expect(formatDuration(194_000)).toBe('3:14');
  expect(formatDuration(65_400)).toBe('1:05');
  expect(formatDuration(null)).toBe('');
});

describe('releaseFormat', () => {
  it('reads the iTunes name suffix first', () => {
    expect(releaseFormat('APT. - Single', 1)).toBe('single');
    expect(releaseFormat('The Book of Us : Gravity - EP', 5)).toBe('ep');
  });

  it('falls back to the track count', () => {
    expect(releaseFormat('Ditto', 2)).toBe('single');
    expect(releaseFormat('New Jeans', 4)).toBe('ep');
    expect(releaseFormat('Palette', 10)).toBe('album');
    expect(releaseFormat('Unknown', undefined)).toBe('album');
  });
});
