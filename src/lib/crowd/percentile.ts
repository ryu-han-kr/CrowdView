// 장소별 백분위 혼잡지수 (외부 점검 P1-1 근본 해결). 서울시 단계('보통')와 인원(6만 명)이 따로 놀아 헷갈린다는 지적 →
// 실측 장소마다 '최근 4주 같은 평일/주말 × 같은 시간(±1시간)' 실제 값 분포에서 지금 값이 어디쯤인지(상위 10%·25% …)를 보여 준다.
// - 서울 121곳: 서울시 인구 중간값 ((최소+최대)/2). 공식 단계는 4개 값뿐이라 백분위가 안 나와 인원을 쓴다
// - 놀이공원·공항 실측 장소: 0~100 점수 (대기분·인원을 장소 기준으로 바꾼 값, 단조라 백분위는 원값과 같다)
// 같은 요일만 쓰면 4주에 표본 4개라 백분위가 의미 없어, 평일/주말·공휴일로 묶고 앞뒤 1시간을 함께 본다
// (평일 칸 한 주 15개 → 1주 뒤부터, 주말 칸 한 주 6개 → 2주 뒤부터 숫자). 표본 MIN_N 미만이면 숨긴다.
// 매시 정각 첫 수집(cron)에 ① 실제 값을 시각별 키에 남기고 ② 지금 칸의 분포 요약(분위수)을 한 키에 저장 → 화면은 GET 1번
import { kv } from "../cache";
import { addDays, kst, kstDateParts } from "../time";
import type { SeoulLive } from "../seoul-live";
import type { CrowdResult } from "../types";
import { learnable } from "./calibration";
import { cellOf } from "./model";

export type PctKind = "seoul" | "place";
/** [표본 수, p10, p25, p50, p75, p90] */
export type Quantiles = [number, number, number, number, number, number];
export type Band = "much-busier" | "busier" | "usual" | "quieter" | "much-quieter";

export const MIN_N = 12;
const WEEKS = 4;
const KEEP_ACTUAL = (WEEKS * 7 + 2) * 86_400;
const KEEP_Q = 2 * 3600;
const KEEP_DONE = 2 * 86_400;

/** 시각 키 YYYY-MM-DDTHH (KST) */
const hourKey = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 13);
/** 서울시 'YYYY-MM-DD HH:mm' → 시각 키 */
const seoulHour = (time: string) => `${time.slice(0, 10)}T${time.slice(11, 13)}`;
const actualKey = (kind: PctKind, target: string) => `pct:a:${kind}:${target}`;
const qKey = (kind: PctKind) => `pct:q:${kind}`;

type Live = Record<string, Omit<SeoulLive, "distance">>;

/** 순수 계산: 분위수 (선형 보간). 표본이 MIN_N 미만이면 undefined */
export function quantiles(xs: number[]): Quantiles | undefined {
  if (xs.length < MIN_N) return undefined;
  const v = [...xs].sort((a, b) => a - b);
  const at = (p: number) => {
    const i = (v.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.min(v.length - 1, lo + 1);
    return Math.round(v[lo] + (v[hi] - v[lo]) * (i - lo));
  };
  return [v.length, at(0.1), at(0.25), at(0.5), at(0.75), at(0.9)];
}

/** 순수 계산: 지금 값이 분포의 어디쯤인지. 분포가 납작해 분위수가 같으면(값이 같으면) '평소 수준' */
export function bandOf(value: number, q: Quantiles): Band {
  const [, p10, p25, , p75, p90] = q;
  if (value > p90) return "much-busier";
  if (value > p75) return "busier";
  if (value < p10) return "much-quieter";
  if (value < p25) return "quieter";
  return "usual";
}

/** 지금 비교에 쓰는 과거 시각 키: 최근 4주 중 같은 평일/주말·공휴일인 날의 h-1·h·h+1시 (오늘은 뺀다) */
export function sampleTargets(now: Date, holidays?: Map<string, string>): string[] {
  const t = kst(now);
  const h = Math.floor(t.hour);
  const dayType = (d: string) => Math.floor(cellOf(kstDateParts(d), holidays) / 24);
  const want = dayType(t.date);
  const out: string[] = [];
  for (let d = 1; d <= WEEKS * 7; d++) {
    const date = addDays(t.date, -d);
    if (dayType(date) !== want) continue;
    for (const hh of [h - 1, h, h + 1]) if (hh >= 0 && hh <= 23) out.push(`${date}T${String(hh).padStart(2, "0")}`);
  }
  return out;
}

/**
 * 매시 정각 첫 수집 때: 실제 값을 시각별 키에 남긴다 (같은 시각은 한 번만).
 * 서울은 서울시 기준 시각(20~40분 늦다)의 시, 장소는 지금 시. 서울시 자료가 있는 장소는 서울 쪽 분포를 쓰므로 장소 쪽에서 뺀다
 */
export async function recordActuals(live: Live, crowd: Record<string, CrowdResult>, now = new Date()): Promise<number> {
  let saved = 0;
  const nowKey = hourKey(now);
  const byHour = new Map<string, Record<string, number>>();
  for (const [code, l] of Object.entries(live)) {
    const k = seoulHour(l.time);
    if (k >= nowKey) continue;
    byHour.set(k, { ...(byHour.get(k) ?? {}), [code]: Math.round((l.min + l.max) / 2) });
  }
  for (const [target, values] of byHour) {
    if (!(await kv.setNX(`pct:done:seoul:${target}`, "1", KEEP_DONE).catch(() => false))) continue;
    await kv.set(actualKey("seoul", target), JSON.stringify(values), KEEP_ACTUAL).catch(() => {});
    saved += Object.keys(values).length;
  }
  const places = Object.fromEntries(
    Object.values(crowd)
      .filter((c) => learnable(c) && c.source !== "seoul-citydata")
      .map((c) => [c.placeId, c.score]),
  );
  if (Object.keys(places).length && (await kv.setNX(`pct:done:place:${nowKey}`, "1", KEEP_DONE).catch(() => false))) {
    await kv.set(actualKey("place", nowKey), JSON.stringify(places), KEEP_ACTUAL).catch(() => {});
    saved += Object.keys(places).length;
  }
  return saved;
}

/** 매시 정각 첫 수집 때: 지금 칸(평일/주말 × 시 ±1)의 분포 요약을 종류별 키 하나에 저장 (Redis 읽기 1번·쓰기 2번). 요약한 장소 수 */
export async function updateQuantiles(now = new Date(), holidays?: Map<string, string>): Promise<number> {
  const targets = sampleTargets(now, holidays);
  const kinds: PctKind[] = ["seoul", "place"];
  const keys = kinds.flatMap((k) => targets.map((t) => actualKey(k, t)));
  const raws = await kv.mget(keys).catch(() => keys.map(() => null));
  let count = 0;
  for (const [i, kind] of kinds.entries()) {
    const samples = new Map<string, number[]>();
    for (const raw of raws.slice(i * targets.length, (i + 1) * targets.length)) {
      if (!raw) continue;
      for (const [id, v] of Object.entries(JSON.parse(raw) as Record<string, number>)) samples.set(id, [...(samples.get(id) ?? []), v]);
    }
    const q: Record<string, Quantiles> = {};
    for (const [id, xs] of samples) {
      const s = quantiles(xs);
      if (s) q[id] = s;
    }
    count += Object.keys(q).length;
    await kv.set(qKey(kind), JSON.stringify({ h: hourKey(now), q }), KEEP_Q).catch(() => {});
  }
  return count;
}

// 화면 렌더링마다 Redis를 읽지 않게 인스턴스 안에서 잠깐 기억한다
const memo = new Map<PctKind, { at: number; q: Record<string, Quantiles> }>();
const MEMO_MS = 60_000;

/** 종류별 분포 요약 (없거나 다른 시간대 것이면 빈 객체) */
export async function getQuantiles(kind: PctKind, now = new Date()): Promise<Record<string, Quantiles>> {
  const m = memo.get(kind);
  if (m && Date.now() - m.at < MEMO_MS) return m.q;
  const raw = await kv.get(qKey(kind)).catch(() => null);
  const parsed = raw ? (JSON.parse(raw) as { h: string; q: Record<string, Quantiles> }) : undefined;
  // 수집기가 멈춰 지난 시간대 요약이 남아 있으면 쓰지 않는다 (앞뒤 1시간까지는 같은 칸으로 본다)
  const ok = parsed && Math.abs(Date.parse(`${parsed.h}:00:00Z`) - Date.parse(`${hourKey(now)}:00:00Z`)) <= 3600_000;
  const q = ok ? parsed.q : {};
  memo.set(kind, { at: Date.now(), q });
  return q;
}

/** 지금 값이 최근 4주 같은 시간대의 어디쯤인지. 표본이 모자라면 undefined */
export async function usualBand(kind: PctKind, id: string, value: number, now = new Date()): Promise<{ band: Band; n: number } | undefined> {
  const q = (await getQuantiles(kind, now))[id];
  return q ? { band: bandOf(value, q), n: q[0] } : undefined;
}
