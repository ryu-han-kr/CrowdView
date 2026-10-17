// 예측 정확도 측정 (서울 실시간 121곳). DB 없이 Redis에 쌓는다.
// 매시간 한 번(수집기의 정시 첫 실행): ① 지금 시각을 목표로 저장해 둔 예측을 실제 값과 비교해 날짜별 통계에 더하고
// ② 앞으로의 예측을 저장한다. 비교하는 예측은 3가지:
//   official-1h / official-3h : 서울시 공식 12시간 예측의 1·3시간 뒤 값
//   pattern-24h               : CrowdView 패턴 예측(가까운 역 요일×시간 승하차, lib/forecast)의 24시간 뒤 값
// 맞춤 기준은 화면과 같은 5단계 (levelOf) 일치, 오차는 점수(0~100) 차이의 절댓값
import { kv } from "./cache";
import { makePredictor, shapeNear } from "./forecast";
import { levelOf } from "./levels";
import { SEOUL_AREAS } from "./seoul-areas";
import type { SeoulLive } from "./seoul-live";
import { kst } from "./time";

export const HORIZONS = [
  { id: "official-1h", hours: 1, label: "서울시 공식 예측 1시간 뒤" },
  { id: "official-3h", hours: 3, label: "서울시 공식 예측 3시간 뒤" },
  { id: "pattern-24h", hours: 24, label: "CrowdView 패턴 예측 24시간 뒤" },
] as const;
export type HorizonId = (typeof HORIZONS)[number]["id"];

export interface DayStat {
  /** 비교한 (지역 × 시각) 수 */
  n: number;
  /** 5단계가 맞은 수 */
  match: number;
  /** 점수 차이 절댓값 합 */
  absErr: number;
}

const KEEP_PRED = 2 * 86_400;
const KEEP_STAT = 60 * 86_400;
/** 목표 시각 키: YYYY-MM-DDTHH (KST) */
const hourKey = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 13);
const predKey = (h: HorizonId, target: string) => `acc:p:${h}:${target}`;
const statKey = (h: HorizonId, date: string) => `acc:d:${h}:${date}`;

type Live = Record<string, Omit<SeoulLive, "distance">>;

/** 서울시 'YYYY-MM-DD HH:mm' → 목표 시각 키 */
const seoulHour = (time: string) => `${time.slice(0, 10)}T${time.slice(11, 13)}`;

/** 정시 첫 수집 때 한 번 부른다: 채점 → 새 예측 저장. 채점한 수를 돌려준다 */
export async function trackAccuracy(live: Live, now = new Date()): Promise<number> {
  const codes = Object.keys(live);
  if (!codes.length) return 0;
  const nowKey = hourKey(now);
  const today = kst(now).date;

  // ① 채점: 실제 값의 기준 시각(서울시는 20~40분 늦게 나온다)을 목표로 했던 예측과 비교. 같은 목표는 한 번만
  let scored = 0;
  const byHour = new Map<string, string[]>();
  for (const c of codes) {
    const k = seoulHour(live[c].time);
    if (k < nowKey) byHour.set(k, [...(byHour.get(k) ?? []), c]);
  }
  for (const [target, group] of byHour) {
    for (const h of HORIZONS) {
      if (!(await kv.setNX(`acc:done:${h.id}:${target}`, "1", KEEP_PRED).catch(() => false))) continue;
      const raw = await kv.get(predKey(h.id, target)).catch(() => null);
      if (!raw) continue;
      const preds = JSON.parse(raw) as Record<string, number>;
      const day = target.slice(0, 10);
      const stat: DayStat = JSON.parse((await kv.get(statKey(h.id, day)).catch(() => null)) ?? '{"n":0,"match":0,"absErr":0}');
      for (const code of group) {
        const pred = preds[code];
        if (pred === undefined) continue;
        const a = live[code].score;
        stat.n++;
        if (levelOf(pred).key === levelOf(a).key) stat.match++;
        stat.absErr += Math.abs(pred - a);
        scored++;
      }
      await kv.set(statKey(h.id, day), JSON.stringify(stat), KEEP_STAT).catch(() => {});
    }
  }

  // ② 새 예측 저장
  const target = (hours: number) => hourKey(new Date(now.getTime() + hours * 3600_000));
  for (const h of HORIZONS) {
    const tKey = target(h.hours);
    const preds: Record<string, number> = {};
    for (const code of codes) {
      const l = live[code];
      if (h.id.startsWith("official")) {
        const f = l.forecast.find((x) => seoulHour(x.time) === tKey);
        if (f) preds[code] = f.score;
      } else {
        const area = SEOUL_AREAS.find((a) => a.code === code);
        const shape = area && shapeNear(area);
        if (!shape) continue;
        // 오늘 0시부터 센 시간으로 실시간·공식 예측을 넣고 비율을 맞춘다 (route-data와 같은 방식)
        const base = Date.parse(`${today}T00:00:00Z`);
        const abs = (time: string) => Math.round((Date.parse(`${time.slice(0, 10)}T${time.slice(11, 13)}:00:00Z`) - base) / 3600_000);
        const known: Record<number, number> = { [abs(l.time)]: l.score };
        for (const f of l.forecast) known[abs(f.time)] = f.score;
        const predict = makePredictor(shape, known, kst(now).day);
        const targetAbs = Math.round((Date.parse(`${tKey}:00:00Z`) - base) / 3600_000);
        if (predict) preds[code] = predict(targetAbs);
      }
    }
    if (Object.keys(preds).length) await kv.set(predKey(h.id, tKey), JSON.stringify(preds), KEEP_PRED).catch(() => {});
  }
  return scored;
}

/** 최근 days일의 날짜별 통계 (Redis 명령 1번) */
export async function getAccuracy(days = 14): Promise<{ date: string; stats: Record<HorizonId, DayStat | null> }[]> {
  const today = kst().date;
  const dates = Array.from({ length: days }, (_, i) => new Date(Date.parse(`${today}T00:00:00Z`) - i * 86_400_000).toISOString().slice(0, 10));
  const keys = dates.flatMap((d) => HORIZONS.map((h) => statKey(h.id, d)));
  const raws = await kv.mget(keys).catch(() => keys.map(() => null));
  return dates.map((date, i) => ({
    date,
    stats: Object.fromEntries(
      HORIZONS.map((h, j) => {
        const r = raws[i * HORIZONS.length + j];
        return [h.id, r ? (JSON.parse(r) as DayStat) : null];
      }),
    ) as Record<HorizonId, DayStat | null>,
  }));
}
