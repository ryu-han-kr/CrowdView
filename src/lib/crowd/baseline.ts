// 평소 수준 (요일 × 시간 168칸): 서울시 지역 인구가 '평소 이 시간'보다 얼마나 많은지 보려고 장소마다 쌓는다.
// 롯데월드처럼 지역(잠실 관광특구) 안의 한 시설은 지역 인구를 그대로 쓰면 10만 명 넘게 부풀려진다 → 지역 단계 대신
// '그 시설의 평소 하루(예측 모델) × 오늘 지역이 평소보다 붐비는 정도'로 본다 (QA 10/21 정확도 개선 1번)
import { kv } from "../cache";
import { kst } from "../time";

/** 새 값을 얼마나 반영할지 (10분마다 들어오니 한 시간에 6번 → 몇 주에 걸쳐 천천히 따라간다) */
const ALPHA = 0.1;
/** 서로 다른 날짜로 이만큼 쌓여야 '평소'로 믿는다 (같은 요일 2주) */
const MIN_DAYS = 2;
const KEEP_SECONDS = 400 * 24 * 3600;

interface Baseline {
  /** 칸별 평소 값 */
  v: number[];
  /** 칸별로 쌓인 서로 다른 날짜 수 */
  d: number[];
  /** 칸별 마지막으로 쌓은 날짜 */
  last: string[];
}

/** 요일(일=0) × 24 + 시 */
export const slotOf = (at: Date) => {
  const k = kst(at);
  return k.day * 24 + Math.floor(k.hour);
};

const empty = (): Baseline => ({ v: Array(168).fill(0), d: Array(168).fill(0), last: Array(168).fill("") });

/** 순수 계산: 지금 값의 평소 대비 배율(평소가 아직 없으면 undefined)과 갱신된 평소 */
export function stepBaseline(b: Baseline, slot: number, value: number, date: string): { ratio?: number; next: Baseline } {
  const ratio = b.d[slot] >= MIN_DAYS && b.v[slot] > 0 ? value / b.v[slot] : undefined;
  const next: Baseline = { v: [...b.v], d: [...b.d], last: [...b.last] };
  next.v[slot] = b.v[slot] > 0 ? b.v[slot] * (1 - ALPHA) + value * ALPHA : value;
  if (b.last[slot] !== date) {
    next.d[slot] = Math.min(99, b.d[slot] + 1);
    next.last[slot] = date;
  }
  return { ratio, next };
}

/** 값을 넣고, 넣기 전 평소와 비교한 배율을 돌려준다 (0.3 ~ 3으로 자른다) */
export async function updateBaseline(placeId: string, value: number, at = new Date()): Promise<number | undefined> {
  if (!(value > 0)) return undefined;
  const key = `base:${placeId}`;
  const raw = await kv.get(key).catch(() => null);
  const b = raw ? (JSON.parse(raw) as Baseline) : empty();
  const { ratio, next } = stepBaseline(b, slotOf(at), value, kst(at).date);
  await kv.set(key, JSON.stringify(next), KEEP_SECONDS).catch(() => {});
  return ratio === undefined ? undefined : Math.min(3, Math.max(0.3, ratio));
}
