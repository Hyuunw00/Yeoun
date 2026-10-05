const BASE_URL = 'https://dapi.kakao.com/v3/search/book';
const REST_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY;

export type KakaoBook = {
  externalId: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedDate: string | null; // YYYY-MM-DD
  coverUrl: string | null;
};

type KakaoBookResponse = {
  title: string;
  authors: string[];
  publisher: string;
  datetime: string;
  isbn: string;
  thumbnail: string;
  url: string;
};

// The thumbnail is a 120px resize; the original image URL sits in its `fname` param
export function originalCoverUrl(thumbnail: string) {
  if (!thumbnail) return null;
  const match = thumbnail.match(/[?&]fname=([^&]+)/);
  if (!match) return thumbnail;
  try {
    return decodeURIComponent(match[1]).replace(/^http:\/\//, 'https://');
  } catch {
    // A malformed escape shouldn't fail the whole search; the small thumbnail still works
    return thumbnail;
  }
}

// Prefer ISBN-13; fall back to ISBN-10, then Daum's own book id, then title + publisher
export function bookExternalId(isbn: string, url: string, title = '', publisher = '') {
  const isbns = isbn.split(' ').filter(Boolean);
  const isbn13 = isbns.find((value) => value.length === 13);
  if (isbn13 ?? isbns[0]) return isbn13 ?? isbns[0];
  const bookId = url.match(/bookId=(\d+)/)?.[1];
  return bookId ? `daum:${bookId}` : `title:${title}|${publisher}`;
}

function toBook(b: KakaoBookResponse): KakaoBook {
  return {
    externalId: bookExternalId(b.isbn, b.url, b.title, b.publisher),
    title: b.title,
    authors: b.authors,
    publisher: b.publisher,
    publishedDate: b.datetime ? b.datetime.slice(0, 10) : null,
    coverUrl: originalCoverUrl(b.thumbnail),
  };
}

export async function searchBooks(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ query, size: '30' });
  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: { Authorization: `KakaoAK ${REST_KEY}` },
    signal,
  });
  if (!res.ok) throw new Error(`Kakao ${res.status}`);
  const data = (await res.json()) as { documents: KakaoBookResponse[] };
  return data.documents.map(toBook);
}
