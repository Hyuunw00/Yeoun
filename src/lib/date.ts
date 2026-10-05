// Local calendar date as YYYY-MM-DD (not UTC)
export function toDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateString(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "2박 3일" for a trip from start to end (inclusive); null for a single day
export function tripLength(start: string, end: string | null) {
  if (!end || end <= start) return null;
  const nights = Math.round((fromDateString(end).getTime() - fromDateString(start).getTime()) / 86_400_000);
  return `${nights}박 ${nights + 1}일`;
}

const dotted = (date: string) => date.replaceAll('-', '.');

// "2026.09.01 – 09.05" for a trip (year repeated only when it changes), else the one date
export function formatTripDates(start: string, end: string | null) {
  if (!end || end <= start) return dotted(start);
  const sameYear = end.slice(0, 4) === start.slice(0, 4);
  return `${dotted(start)} – ${dotted(sameYear ? end.slice(5) : end)}`;
}
