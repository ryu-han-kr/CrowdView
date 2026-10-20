// 실측 기록. 데이터를 새로 가져올 때마다 하루 단위 키에 쌓아, "어제부터 지금까지" 추이를 보여준다.
// Redis(Upstash)가 연결돼 있어야 서버 인스턴스 사이에 공유되고 배포 후에도 남는다 (없으면 인스턴스 메모리).
import { kv } from "../cache";
import { addDays, kst } from "../time";
import type { CrowdSnapshot } from "../types";

const KEEP_SECONDS = 8 * 24 * 60 * 60;
const MIN_GAP_MS = 4 * 60_000;

export interface HistoryPoint {
  /** ISO 시각 */
  t: string;
  score: number;
  headcount: number;
  /** 구역별 [id, 점수, 대기분, 대기인원] */
  zones?: [string, number, number | null, number | null][];
}

const key = (placeId: string, date: string) => `hist:${placeId}:${date}`;

async function readDay(placeId: string, date: string): Promise<HistoryPoint[]> {
  try {
    const raw = await kv.get(key(placeId, date));
    return raw ? (JSON.parse(raw) as HistoryPoint[]) : [];
  } catch {
    return [];
  }
}

/** 실데이터 스냅샷만 기록한다 (모델값은 기록하지 않음) */
export async function recordHistory(snap: CrowdSnapshot): Promise<void> {
  if (snap.source === "model") return;
  const date = kst(new Date(snap.updatedAt)).date;
  const day = await readDay(snap.placeId, date);
  const last = day.at(-1);
  if (last && Date.parse(snap.updatedAt) - Date.parse(last.t) < MIN_GAP_MS) return;
  day.push({
    t: snap.updatedAt,
    score: snap.score,
    headcount: snap.headcount,
    // 기록은 대기 긴 8곳만 (구역별 보기용 전체 목록은 화면 캐시에만)
    zones: snap.zones?.slice(0, 8).map((z) => [z.id, z.score, z.waitMin ?? null, z.people ?? null]),
  });
  await kv.set(key(snap.placeId, date), JSON.stringify(day), KEEP_SECONDS).catch(() => {});
}

/** 최근 n일(오늘 포함) 기록, 날짜 오름차순 */
export async function getHistory(placeId: string, days = 2): Promise<{ date: string; points: HistoryPoint[] }[]> {
  const today = kst().date;
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  return Promise.all(dates.map(async (date) => ({ date, points: await readDay(placeId, date) })));
}

// ── 하루 요약: 실측 기록(8일 보관)을 하루 한 번 [날짜, 가장 붐빌 때, 평균]으로 줄여 1년 넘게 둔다.
// 요일별·월별 평균을 예측 대신 실측으로 보여 주려고 (레퍼런스: Queue-Times 통계)
const SUM_KEEP_SECONDS = 400 * 24 * 60 * 60;
const sumKey = (placeId: string) => `daysum:${placeId}`;

/** [YYYY-MM-DD, 가장 붐빌 때 점수, 평균 점수] */
export type DaySummary = [string, number, number];

export async function getDaySummaries(placeId: string): Promise<DaySummary[]> {
  try {
    const raw = await kv.get(sumKey(placeId));
    return raw ? (JSON.parse(raw) as DaySummary[]) : [];
  } catch {
    return [];
  }
}

/** 어제 기록을 요약해 붙인다 (이미 있으면 건너뜀). 붙였으면 true */
export async function summarizeDay(placeId: string, date: string): Promise<boolean> {
  const points = await readDay(placeId, date);
  // 운영 시간 기록이 너무 적으면(수집 장애 등) 평균이 왜곡돼 남기지 않는다
  if (points.length < 12) return false;
  const list = await getDaySummaries(placeId);
  if (list.some(([d]) => d === date)) return false;
  const scores = points.map((p) => p.score);
  list.push([date, Math.max(...scores), Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)]);
  await kv.set(sumKey(placeId), JSON.stringify(list.slice(-400)), SUM_KEEP_SECONDS);
  return true;
}
