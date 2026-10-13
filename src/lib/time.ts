const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface KstParts {
  date: string; // YYYY-MM-DD
  day: number; // 0=일 ... 6=토
  hour: number; // 소수 포함 (14.5 = 14:30)
}

export function kst(at: Date = new Date()): KstParts {
  const d = new Date(at.getTime() + KST_OFFSET_MS);
  return {
    date: d.toISOString().slice(0, 10),
    day: d.getUTCDay(),
    hour: d.getUTCHours() + d.getUTCMinutes() / 60,
  };
}

export function kstDateParts(date: string): KstParts {
  const d = new Date(`${date}T00:00:00Z`);
  return { date, day: d.getUTCDay(), hour: 0 };
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export function daysUntil(date: string, from: Date = new Date()): number {
  const today = Date.parse(`${kst(from).date}T00:00:00Z`);
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / 86_400_000);
}

export function formatAge(minutes: number): string {
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.floor(minutes / 60)}시간 전`;
}

export function formatHour(h: number): string {
  return `${String(h === 24 ? 24 : Math.floor(h) % 24).padStart(2, "0")}시`;
}
