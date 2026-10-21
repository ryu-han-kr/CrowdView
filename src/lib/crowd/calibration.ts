// 실측과 비교해 예측 모델 고치기 (10/21). 실측 원천이 있는 장소(서울시 지역·놀이공원 대기·공항)에서 매시간
// '모델만으로 냈을 점수'와 실제 점수를 비교해 ① 날짜별 오차(장소별, 보정 전·후) ② 장소별 보정 칸(평일/주말 × 24시)을 쌓는다.
// 보정은 곱셈: 칸마다 log((실제+5)/(모델+5))의 이동 평균. 처음엔 단순 평균, 10번 넘으면 최근 값을 10%씩 반영(EWMA).
// 쓸 때는 쌓인 수로 줄여서(n/(n+6)) 믿고 0.6~1.6배로 자른다. 실측 장소는 자기 칸을, 실측 없는 같은 종류 장소는
// 종류 평균을 절반만 쓴다(장소마다 다를 수 있으니). 지역 안 시설(롯데월드 ⊂ 잠실)은 점수가 모델에서 나오므로 배우지 않는다
import { kv } from "../cache";
import { addDays, kst, type KstParts } from "../time";
import type { CrowdResult, Place } from "../types";
import { cellOf } from "./model";

export const CELLS = 48;
const OFFSET = 5;
const MIN_ALPHA = 0.1;
const SHRINK = 6;
const MIN_F = 0.6;
const MAX_F = 1.6;
/** 종류 평균을 다른 장소에 옮길 때 믿는 정도 */
const TRANSFER = 0.5;
const KEEP_CELL = 400 * 86_400;
const KEEP_STAT = 60 * 86_400;

export interface Cells {
  /** 칸별 log 비율 평균 */
  v: number[];
  /** 칸별 비교 수 (최대 99) */
  n: number[];
}

/** 날짜별 장소 오차: 비교 수, |모델−실제| 합, |보정 모델−실제| 합, (실제−모델) 합 */
export interface CalibStat {
  n: number;
  raw: number;
  cal: number;
  bias: number;
}

const cellKey = (id: string) => `calib:${id}`;
const catKey = (c: Place["category"]) => `calib:cat:${c}`;
const statKey = (date: string) => `calib:d:${date}`;

export const emptyCells = (): Cells => ({ v: Array(CELLS).fill(0), n: Array(CELLS).fill(0) });

/** 순수 계산: 한 번 비교한 결과를 칸에 넣는다 */
export function stepCells(c: Cells, cell: number, model: number, actual: number): Cells {
  const r = Math.log((actual + OFFSET) / (model + OFFSET));
  const next: Cells = { v: [...c.v], n: [...c.n] };
  const alpha = Math.max(MIN_ALPHA, 1 / (c.n[cell] + 1));
  next.v[cell] = c.v[cell] * (1 - alpha) + r * alpha;
  next.n[cell] = Math.min(99, c.n[cell] + 1);
  return next;
}

/** 칸 → 곱할 배율 (weight: 다른 장소에 옮길 때 0.5) */
export function factorsOf(c: Cells, weight = 1): number[] {
  return c.v.map((v, i) => {
    const f = Math.exp(v * weight * (c.n[i] / (c.n[i] + SHRINK)));
    return Math.max(MIN_F, Math.min(MAX_F, Math.round(f * 1000) / 1000));
  });
}

/** 여러 장소 칸을 비교 수로 가중 평균 (종류 평균) */
export function poolCells(list: Cells[]): Cells {
  const out = emptyCells();
  for (let i = 0; i < CELLS; i++) {
    const n = list.reduce((a, c) => a + c.n[i], 0);
    out.v[i] = n ? list.reduce((a, c) => a + c.v[i] * c.n[i], 0) / n : 0;
    out.n[i] = Math.min(99, n);
  }
  return out;
}

const parse = (raw: string | null) => (raw ? (JSON.parse(raw) as Cells) : null);

/** 예측에 곱할 48칸 배율. 자기 칸이 있으면 그것, 없으면 같은 종류 평균의 절반. 둘 다 없으면 undefined (Redis 명령 1번) */
export async function getCalibration(place: Place): Promise<number[] | undefined> {
  const [own, cat] = (await kv.mget([cellKey(place.id), catKey(place.category)]).catch(() => [null, null])).map(parse);
  if (own?.n.some(Boolean)) return factorsOf(own);
  if (cat?.n.some(Boolean)) return factorsOf(cat, TRANSFER);
  return undefined;
}

/** 배울 수 있는 실측인지: 실측 원천 · 지역 안 시설 아님 · 운영 중 · 20분 안 */
export const learnable = (c: CrowdResult) => c.source !== "model" && !c.area && c.open && c.ageMinutes <= 20;

export interface Sample {
  place: Place;
  t: KstParts;
  holidays?: Map<string, string>;
  /** 보정 없이 모델만 */
  raw: number;
  /** 지금 쓰는 보정을 곱한 모델 */
  cal: number;
  actual: number;
}

/** 매시 정각 첫 수집 때: 비교 결과를 칸과 날짜별 오차에 넣는다. 넣은 수 */
export async function recordCalibration(samples: Sample[], now = new Date()): Promise<number> {
  if (!samples.length) return 0;
  const today = kst(now).date;
  if (!(await kv.setNX(`calib:done:${today}T${Math.floor(kst(now).hour)}`, "1", 2 * 3600).catch(() => false))) return 0;
  const stats: Record<string, CalibStat> = JSON.parse((await kv.get(statKey(today)).catch(() => null)) ?? "{}");
  const cats = new Set<Place["category"]>();
  for (const s of samples) {
    const cells = parse(await kv.get(cellKey(s.place.id)).catch(() => null)) ?? emptyCells();
    await kv.set(cellKey(s.place.id), JSON.stringify(stepCells(cells, cellOf(s.t, s.holidays), s.raw, s.actual)), KEEP_CELL).catch(() => {});
    const st = stats[s.place.id] ?? { n: 0, raw: 0, cal: 0, bias: 0 };
    stats[s.place.id] = {
      n: st.n + 1,
      raw: st.raw + Math.abs(s.raw - s.actual),
      cal: st.cal + Math.abs(s.cal - s.actual),
      bias: st.bias + (s.actual - s.raw),
    };
    cats.add(s.place.category);
  }
  await kv.set(statKey(today), JSON.stringify(stats), KEEP_STAT).catch(() => {});
  // 종류 평균 다시 계산 (이번에 배운 장소들 기준)
  for (const cat of cats) {
    const ids = samples.filter((s) => s.place.category === cat).map((s) => cellKey(s.place.id));
    const list = (await kv.mget(ids).catch(() => [])).map(parse).filter((c): c is Cells => !!c);
    if (list.length) await kv.set(catKey(cat), JSON.stringify(poolCells(list)), KEEP_CELL).catch(() => {});
  }
  return samples.length;
}

/** 최근 days일 장소별 오차 합계 (Redis 명령 1번) */
export async function getCalibrationStats(days = 7): Promise<Record<string, CalibStat>> {
  const today = kst().date;
  const keys = Array.from({ length: days }, (_, i) => statKey(addDays(today, -i)));
  const raws = await kv.mget(keys).catch(() => keys.map(() => null));
  const out: Record<string, CalibStat> = {};
  for (const raw of raws) {
    if (!raw) continue;
    for (const [id, s] of Object.entries(JSON.parse(raw) as Record<string, CalibStat>)) {
      const o = out[id] ?? { n: 0, raw: 0, cal: 0, bias: 0 };
      out[id] = { n: o.n + s.n, raw: o.raw + s.raw, cal: o.cal + s.cal, bias: o.bias + s.bias };
    }
  }
  return out;
}
