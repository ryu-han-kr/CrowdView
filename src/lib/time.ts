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

/** 'YYYY-MM-DD' → '10/02' (화면 공통 날짜 표기) */
export const shortDate = (date: string) => date.slice(5).replace("-", "/");

/** 기간 '10/02 ~ 10/25' (하루면 날짜 하나, 해가 바뀌면 앞에 연도) */
export function dateRange(start: string, end: string): string {
  if (start === end) return shortDate(start);
  const year = start.slice(0, 4) !== end.slice(0, 4);
  return year ? `${start.slice(0, 4)}/${shortDate(start)} ~ ${end.slice(0, 4)}/${shortDate(end)}` : `${shortDate(start)} ~ ${shortDate(end)}`;
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

/** 22.5 → 22:30 */
/** 14.5 → "14:30". 밤샘 영업의 닫는 시각(24 넘음, 구글 지도 운영 시간)은 다음 날 시각으로 (26 → "02:00"), 24는 "24:00" */
export function formatClock(h: number): string {
  if (h > 24) h -= 24;
  const hh = Math.floor(h);
  return `${String(hh).padStart(2, "0")}:${String(Math.round((h - hh) * 60)).padStart(2, "0")}`;
}

export function formatHour(h: number): string {
  return `${String(h === 24 ? 24 : Math.floor(h) % 24).padStart(2, "0")}시`;
}
