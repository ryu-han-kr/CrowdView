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
    zones: snap.zones?.map((z) => [z.id, z.score, z.waitMin ?? null, z.people ?? null]),
  });
  await kv.set(key(snap.placeId, date), JSON.stringify(day), KEEP_SECONDS).catch(() => {});
}

/** 최근 n일(오늘 포함) 기록, 날짜 오름차순 */
export async function getHistory(placeId: string, days = 2): Promise<{ date: string; points: HistoryPoint[] }[]> {
  const today = kst().date;
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  return Promise.all(dates.map(async (date) => ({ date, points: await readDay(placeId, date) })));
}
