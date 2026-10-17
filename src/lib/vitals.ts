// 실사용 화면 속도(Core Web Vitals) 집계: 날짜·지표·등급(good/needs-improvement/poor)별 횟수만 Redis에 센다 (개인 정보 없음)
import { kv } from "./cache";
import { kst, addDays } from "./time";

export const METRICS = ["LCP", "INP", "CLS"] as const;
export const RATINGS = ["good", "needs-improvement", "poor"] as const;
const TTL = 35 * 86_400;
const key = (date: string, m: string, r: string) => `vitals:${date}:${m}:${r}`;

export async function recordVitals(metrics: { n: string; r: string }[]): Promise<number> {
  const ok = metrics.filter((x) => (METRICS as readonly string[]).includes(x.n) && (RATINGS as readonly string[]).includes(x.r)).slice(0, 3);
  const date = kst().date;
  await Promise.all(ok.map((x) => kv.incr(key(date, x.n, x.r), TTL)));
  return ok.length;
}

/** 최근 days일 지표별 '좋음' 비율과 표본 수 */
export async function getVitals(days = 7): Promise<Record<string, { good: number; total: number; pct: number | null }>> {
  const today = kst().date;
  const dates = Array.from({ length: days }, (_, i) => addDays(today, -i));
  const keys = dates.flatMap((d) => METRICS.flatMap((m) => RATINGS.map((r) => key(d, m, r))));
  const vals = await kv.mget(keys).catch(() => keys.map(() => null));
  const out: Record<string, { good: number; total: number; pct: number | null }> = {};
  for (const m of METRICS) out[m] = { good: 0, total: 0, pct: null };
  keys.forEach((k, i) => {
    const [, , m, r] = k.split(":");
    const n = Number(vals[i] ?? 0);
    out[m].total += n;
    if (r === "good") out[m].good += n;
  });
  for (const m of METRICS) out[m].pct = out[m].total ? Math.round((out[m].good / out[m].total) * 100) : null;
  return out;
}
