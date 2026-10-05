/// <reference types="jest" />

import { bookExternalId, originalCoverUrl } from '@/lib/kakao';

describe('originalCoverUrl', () => {
  it('extracts and decodes the original image from the thumbnail fname param over https', () => {
    const thumbnail =
      'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F532683%3Ftimestamp%3D20260930111213';
    expect(originalCoverUrl(thumbnail)).toBe('https://t1.daumcdn.net/lbook/image/532683?timestamp=20260930111213');
  });

  it('returns null for an empty thumbnail', () => {
    expect(originalCoverUrl('')).toBeNull();
  });

  it('falls back to the thumbnail when the fname param is malformed', () => {
    const thumbnail = 'https://search1.kakaocdn.net/thumb/R120x174/?fname=%E0%A4%A';
    expect(originalCoverUrl(thumbnail)).toBe(thumbnail);
  });

  it('keeps a thumbnail without an fname param as is', () => {
    expect(originalCoverUrl('https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg');
  });
});

describe('bookExternalId', () => {
  it('prefers ISBN-13 when both are present', () => {
    expect(bookExternalId('8936434128 9788936434120', '')).toBe('9788936434120');
  });

  it('falls back to ISBN-10, wherever it sits in the string', () => {
    expect(bookExternalId(' 8936434128', '')).toBe('8936434128');
  });

  it('falls back to title and publisher when there is no ISBN or book id', () => {
    expect(bookExternalId('', '', '소년이 온다', '창비')).toBe('title:소년이 온다|창비');
  });

  it('falls back to the Daum book id without any ISBN', () => {
    expect(bookExternalId('', 'https://search.daum.net/search?w=bookpage&bookId=532683&q=x')).toBe('daum:532683');
  });
});
