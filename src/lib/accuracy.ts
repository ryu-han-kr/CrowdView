// 예측 정확도 측정 (서울 실시간 121곳). DB 없이 Redis에 쌓는다.
// 매시간 한 번(수집기의 정시 첫 실행): ① 지금 시각을 목표로 저장해 둔 예측을 실제 값과 비교해 날짜별 통계에 더하고
// ② 앞으로의 예측을 저장한다. 비교하는 예측은 3가지:
//   official-1h / official-3h : 서울시 공식 12시간 예측의 1·3시간 뒤 값
//   pattern-24h               : CrowdView 패턴 예측(가까운 역 요일×시간 승하차, lib/forecast)의 24시간 뒤 값
//   naive-24h / median-24h    : 기준선 (외부 점검 P1-5). 지금 값을 그대로 24시간 뒤 예측 / 최근 4주 같은 요일·시각 실제 값의 중앙값.
//   weekly-24h                : 기준선. 지난주 같은 요일·시각 실제 값
//   hybrid-24h                : 혼합 (10/31 수준 진단: 패턴 예측 27% < '지금 값 그대로' 79%). 내일이 오늘과 같은 종류의 날(평일↔평일, 주말↔주말)이면
//                               지금 값, 평일↔주말이 바뀌면 지난주 같은 요일·시각 값 — '지금 값 그대로'가 틀리는 금→토·일→월을 지난주로 메운다
//                               패턴 예측이 기준선보다 낫지 않으면 기준선을 쓰는 게 맞다 — 같은 지표로 나란히 비교한다
//   ensemble-24h / learned-24h: 실제 결과로 매시간 고치는 앙상블·학습 모델 (lib/accuracy-learn). 채점 때 상태(acc:learn 한 키)를 고치고,
//                               학습 모델은 예측 때 입력을 acc:f:{목표}에 남겨 두었다가 실제 값이 오면 배운다
//   naive-1h·3h / blend-1h·3h : 지금 값 그대로 / 지역별 치우침을 뺀 공식 예측과 지금 값을 최근 오차로 섞은 값 (서울시 1·3시간 예측과 비교)
// 맞춤 기준은 화면과 같은 5단계 (levelOf) 일치, 오차는 점수(0~100) 차이의 절댓값. 1단계 이내(near)·낮 시간(08~22시) 일치도 따로 센다
// P1-5 2단계: 최근 7일 합계에서 기준선이 패턴 예측을 단계 일치·평균 오차 둘 다 이기면(비교 수 MIN_PICK_N 이상) 그 방법을
// 24시간 예측(한산한 코스의 내일·주말 점수)에 자동으로 쓴다 (getMethod24). 4주 중앙값은 요일×시 168칸 프로필(acc:prof)로 들고 있다
import {
  ENS_CANDS,
  blendPredict,
  blendUpdate,
  ensemblePredict,
  ensembleUpdate,
  isNight,
  LEARN_DIM,
  learnInit,
  learnPredict,
  learnUpdate,
  rlsInit,
  transitInputs,
  type EnsCand,
  type LearnRaw,
  type LearnState,
} from "./accuracy-learn";
import { kv } from "./cache";
import { extraLogKey } from "./seoul-extra-log";
import { makePredictor, shapeNear } from "./forecast";
import { levelOf } from "./levels";
import { SEOUL_AREAS } from "./seoul-areas";
import type { SeoulLive } from "./seoul-live";
import { kst } from "./time";

export const HORIZONS = [
  { id: "official-1h", hours: 1, label: "서울시 공식 예측 1시간 뒤" },
  { id: "naive-1h", hours: 1, label: "기준선: 지금 값 그대로 1시간 뒤" },
  { id: "blend-1h", hours: 1, label: "CrowdView 단기 혼합: 지금 값 + 치우침을 뺀 공식 예측 1시간 뒤" },
  { id: "official-3h", hours: 3, label: "서울시 공식 예측 3시간 뒤" },
  { id: "naive-3h", hours: 3, label: "기준선: 지금 값 그대로 3시간 뒤" },
  { id: "blend-3h", hours: 3, label: "CrowdView 단기 혼합: 지금 값 + 치우침을 뺀 공식 예측 3시간 뒤" },
  { id: "pattern-24h", hours: 24, label: "CrowdView 패턴 예측 24시간 뒤" },
  { id: "naive-24h", hours: 24, label: "기준선: 지금 값 그대로 24시간 뒤" },
  { id: "median-24h", hours: 24, label: "기준선: 최근 4주 같은 요일·시각 중앙값" },
  { id: "weekly-24h", hours: 24, label: "기준선: 지난주 같은 요일·시각" },
  { id: "hybrid-24h", hours: 24, label: "CrowdView 혼합: 같은 종류의 날이면 지금 값, 평일↔주말이 바뀌면 지난주 같은 시각" },
  { id: "ensemble-24h", hours: 24, label: "CrowdView 앙상블: 지역마다 최근에 잘 맞은 기준선에 더 무게" },
  { id: "learned-24h", hours: 24, label: "CrowdView 학습 모델: 실제 결과로 매시간 스스로 고치는 학습 모델" },
] as const;
export type HorizonId = (typeof HORIZONS)[number]["id"];

export interface DayStat {
  /** 비교한 (지역 × 시각) 수 */
  n: number;
  /** 5단계가 맞은 수 */
  match: number;
  /** 점수 차이 절댓값 합 */
  absErr: number;
  /** 1단계 이내로 맞은 수 (11/1부터, 옛 기록엔 없다) */
  near?: number;
  /** 낮 시간(목표 08~21시 KST, 08:00~22:00) 비교 수·단계 일치 수 (11/1부터) */
  dayN?: number;
  dayMatch?: number;
}
/** 낮 시간: 목표 시각 08~21시 (KST) */
export const isDaytime = (hour: number) => hour >= 8 && hour < 22;

const KEEP_PRED = 2 * 86_400;
const KEEP_STAT = 60 * 86_400;
/** 목표 시각 키: YYYY-MM-DDTHH (KST) */
const hourKey = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 13);
const predKey = (h: HorizonId, target: string) => `acc:p:${h}:${target}`;
const statKey = (h: HorizonId, date: string) => `acc:d:${h}:${date}`;
/** 지역별 실제 점수 (목표 시각별). 4주 중앙값 기준선용으로 30일 보관 */
const actualKey = (target: string) => `acc:a:${target}`;
const KEEP_ACTUAL = 30 * 86_400;
/** 목표 시각 키에서 hours시간 전 시각 키 */
const hoursBefore = (target: string, hours: number) => new Date(Date.parse(`${target}:00:00Z`) - hours * 3600_000).toISOString().slice(0, 13);
const median = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
};

/** 24시간 예측 방법 */
export type Method24 = "pattern-24h" | "naive-24h" | "median-24h" | "weekly-24h" | "hybrid-24h" | "ensemble-24h" | "learned-24h";
const ALT24 = ["naive-24h", "median-24h", "weekly-24h", "hybrid-24h"] as const;
/**
 * 실제 결과로 고치는 방법. 되짚기(10/28~31)에서 지난주 같은 시각보다 단계 일치가 낮아(학습 82.6% vs 83.1%, 앙상블 81.4%)
 * 기준선·혼합 중 자격을 갖춘 것 모두를 단계 일치·평균 오차 둘 다 이겨야만 고른다 (더 엄격한 안전 규칙)
 */
const ADAPT24 = ["ensemble-24h", "learned-24h"] as const;
/** 주말(토·일) 여부 — 혼합 예측이 '같은 종류의 날'을 가르는 기준 */
export const isWeekendDay = (day: number) => day === 0 || day === 6;
/** 기준선으로 바꾸려면 7일 비교 수가 이만큼은 있어야 한다 (121곳 × 하루 약 20시간 ≈ 2,400/일 → 하루 반 치) */
export const MIN_PICK_N = 3000;
const PROFILE_KEY = "acc:prof";
/** 지역 코드 → 요일×시 168칸의 가장 최근 실제 값 (매시간 지금 칸을 덮어씀 → 앞으로의 칸은 지난주 값) */
const WEEK_KEY = "acc:wk";
const KEEP_PROFILE = 400 * 86_400;
/** 지역 코드 → 요일(일=0)×24+시 168칸의 4주 중앙값 (없는 칸은 null) */
export type MedianProfile = Record<string, (number | null)[]>;

/**
 * 순수 계산: 7일 합계로 24시간 예측에 쓸 방법. 기준선이 패턴 예측을 단계 일치·평균 오차 둘 다 이길 때만 바꾼다 (둘 다 이기면 오차가 작은 쪽).
 * 앙상블·학습 모델은 거기에 더해 비교 수가 충분한 기준선·혼합 모두를 둘 다 이겨야 후보가 된다
 */
export function pickMethod24(sum: { "pattern-24h": DayStat } & Partial<Record<Method24, DayStat>>): Method24 {
  const rate = (s: DayStat) => (s.n ? s.match / s.n : 0);
  const err = (s: DayStat) => (s.n ? s.absErr / s.n : Infinity);
  const base = sum["pattern-24h"];
  if (base.n < MIN_PICK_N) return "pattern-24h";
  const enough = (m: Method24) => !!sum[m] && sum[m].n >= MIN_PICK_N;
  const beats = (m: Method24, o: DayStat) => rate(sum[m]!) > rate(o) && err(sum[m]!) < err(o);
  const simple = ALT24.filter(enough);
  const better: Method24[] = [
    ...simple.filter((m) => beats(m, base)),
    ...ADAPT24.filter((m) => enough(m) && beats(m, base) && simple.every((s) => beats(m, sum[s]!))),
  ];
  if (!better.length) return "pattern-24h";
  return better.sort((a, b) => err(sum[a]!) - err(sum[b]!))[0];
}

/** 최근 7일 합계와 지금 쓰는 방법 (Redis 명령 1번) */
export async function getMethod24(): Promise<{ method: Method24; sum: Record<Method24, DayStat> }> {
  const rows = await getAccuracy(7);
  const sum = {} as Record<Method24, DayStat>;
  for (const m of ["pattern-24h", ...ALT24, ...ADAPT24] as const) {
    sum[m] = rows.reduce<DayStat>((a, r) => {
      const s = r.stats[m];
      return s ? { n: a.n + s.n, match: a.match + s.match, absErr: a.absErr + s.absErr } : a;
    }, { n: 0, match: 0, absErr: 0 });
  }
  return { method: pickMethod24(sum), sum };
}

/** 지난주(가장 최근) 같은 요일·시각 값 프로필 (없으면 빈 객체) */
export async function getWeekProfile(): Promise<MedianProfile> {
  const raw = await kv.get(WEEK_KEY).catch(() => null);
  return raw ? (JSON.parse(raw) as MedianProfile) : {};
}

const LEARN_KEY = "acc:learn";
/** 학습 모델 입력 (목표 시각별, 지역 코드 → LearnRaw) */
const featKey = (target: string) => `acc:f:${target}`;

/** 저장한 상태 문자열 → 상태 (없거나 모양이 다르면 null) */
export function parseLearnState(raw: string | null): LearnState | null {
  if (!raw) return null;
  try {
    const st = JSON.parse(raw) as LearnState;
    if (!(st.v === 1 && st.rls?.w?.length && st.ens && st.lb && st.blend?.["1h"] && st.blend["3h"])) return null;
    // 특징 수가 바뀌었으면 (11/1 10 → 12) 학습 모델만 처음부터, 앙상블·단기 혼합은 그대로
    if (st.rls.w.length !== LEARN_DIM) {
      st.rls = rlsInit();
      st.lb = {};
    }
    return st;
  } catch {
    return null;
  }
}

/** 앙상블·학습 모델·단기 혼합 상태 (없으면 null) */
export async function getLearnState(): Promise<LearnState | null> {
  return parseLearnState(await kv.get(LEARN_KEY).catch(() => null));
}

/** 4주 중앙값 프로필 (없으면 빈 객체) */
export async function getMedianProfile(): Promise<MedianProfile> {
  const raw = await kv.get(PROFILE_KEY).catch(() => null);
  return raw ? (JSON.parse(raw) as MedianProfile) : {};
}

type Live = Record<string, Omit<SeoulLive, "distance">>;

/** 서울시 'YYYY-MM-DD HH:mm' → 목표 시각 키 */
const seoulHour = (time: string) => `${time.slice(0, 10)}T${time.slice(11, 13)}`;

/** 앙상블 후보 → 그 후보의 24시간 예측 방법 */
const ENS_H: Record<EnsCand, HorizonId> = { naive: "naive-24h", weekly: "weekly-24h", hybrid: "hybrid-24h", median: "median-24h" };
/** 다른 방법의 예측을 받아 만드는 방법 (예측 저장 때 뒤에 계산) */
const DERIVED = new Set<HorizonId>(["blend-1h", "blend-3h", "ensemble-24h", "learned-24h"]);

/** 정시 첫 수집 때 한 번 부른다: 채점·모델 고치기 → 새 예측 저장. 채점한 수를 돌려준다 */
export async function trackAccuracy(live: Live, now = new Date()): Promise<number> {
  const codes = Object.keys(live);
  if (!codes.length) return 0;
  const nowKey = hourKey(now);
  const today = kst(now).date;
  // 모델 상태: 읽기에 실패하면 새로 만든 상태로 예측만 하고 저장하지 않는다 (쌓아 온 상태를 덮어쓰지 않게)
  let saveState = true;
  const st =
    parseLearnState(
      await kv.get(LEARN_KEY).catch(() => {
        saveState = false;
        return null;
      }),
    ) ?? learnInit();

  // ① 채점: 실제 값의 기준 시각(서울시는 20~40분 늦게 나온다)을 목표로 했던 예측과 비교. 같은 목표는 한 번만
  let scored = 0;
  const byHour = new Map<string, string[]>();
  for (const c of codes) {
    const k = seoulHour(live[c].time);
    if (k < nowKey) byHour.set(k, [...(byHour.get(k) ?? []), c]);
  }
  for (const [target, group] of byHour) {
    // 실제 값을 시각별로 남긴다 (같은 시각은 한 번만)
    if (await kv.setNX(`acc:done:actual:${target}`, "1", KEEP_PRED).catch(() => false)) {
      await kv.set(actualKey(target), JSON.stringify(Object.fromEntries(group.map((c) => [c, live[c].score]))), KEEP_ACTUAL).catch(() => {});
    }
    // 11/1부터 방법별이 아니라 목표 하나로 잠그고, 예측·통계·학습 입력을 명령 1번으로 읽는다 (방법이 13개라 Redis 명령 수를 줄이려고)
    if (!(await kv.setNX(`acc:done:score:${target}`, "1", KEEP_PRED).catch(() => false))) continue;
    const day = target.slice(0, 10);
    const hour = Number(target.slice(11, 13));
    const H = HORIZONS.length;
    const raws = await kv
      .mget([...HORIZONS.map((h) => predKey(h.id, target)), ...HORIZONS.map((h) => statKey(h.id, day)), featKey(target)])
      .catch(() => [] as (string | null)[]);
    const preds: Partial<Record<HorizonId, Record<string, number>>> = {};
    const writes: Promise<void>[] = [];
    HORIZONS.forEach((h, i) => {
      if (!raws[i]) return;
      const p = (preds[h.id] = JSON.parse(raws[i]!) as Record<string, number>);
      const stat: DayStat = raws[H + i] ? JSON.parse(raws[H + i]!) : { n: 0, match: 0, absErr: 0 };
      // 1단계 이내·낮 시간은 그날 처음부터 센 날만 (옛 기록이 있는 날 중간부터 세면 비율이 틀린다)
      const track = !stat.n || stat.near !== undefined;
      if (track) {
        stat.near ??= 0;
        stat.dayN ??= 0;
        stat.dayMatch ??= 0;
      }
      let n = 0;
      for (const code of group) {
        const pred = p[code];
        if (pred === undefined) continue;
        const a = live[code].score;
        const lp = levelOf(pred).key;
        const la = levelOf(a).key;
        stat.n++;
        if (lp === la) stat.match++;
        stat.absErr += Math.abs(pred - a);
        if (track) {
          if (Math.abs(lp - la) <= 1) stat.near!++;
          if (isDaytime(hour)) {
            stat.dayN!++;
            if (lp === la) stat.dayMatch!++;
          }
        }
        n++;
      }
      scored += n;
      if (n) writes.push(kv.set(statKey(h.id, day), JSON.stringify(stat), KEEP_STAT).catch(() => {}));
    });
    await Promise.all(writes);
    // 모델 고치기: 이 목표를 겨냥했던 후보 예측·학습 입력과 실제 값
    const feats = raws[2 * H] ? (JSON.parse(raws[2 * H]!) as Record<string, LearnRaw>) : {};
    for (const code of group) {
      const a = live[code].score;
      const cands: Partial<Record<EnsCand, number>> = {};
      for (const c of ENS_CANDS) if (typeof preds[ENS_H[c]]?.[code] === "number") cands[c] = preds[ENS_H[c]]![code];
      if (Object.keys(cands).length) st.ens[code] = ensembleUpdate(st.ens[code], cands, a);
      if (feats[code]) learnUpdate(st, code, feats[code], a);
      for (const hz of ["1h", "3h"] as const) {
        const l = preds[`naive-${hz}`]?.[code];
        if (l !== undefined) blendUpdate(st.blend[hz], code, l, preds[`official-${hz}`]?.[code], a);
      }
    }
    st.at = target;
  }

  // ② 새 예측 저장
  const target = (hours: number) => hourKey(new Date(now.getTime() + hours * 3600_000));
  const t24 = target(24);
  // 4주 중앙값 기준선: 목표 시각의 7·14·21·28일 전 실제 값 (2개 이상 있을 때만). 학습 모델용으로 지난주 같은 시각의 앞뒤 1시간과
  // 지난 두 시각의 승하차·주차 기록(lib/seoul-extra-log, 이번 시각 것은 이 다음에 기록된다)도
  const past = await kv
    .mget([
      ...[7, 14, 21, 28].map((d) => actualKey(hoursBefore(t24, d * 24))),
      actualKey(hoursBefore(t24, 169)),
      actualKey(hoursBefore(t24, 167)),
      extraLogKey(hoursBefore(nowKey, 1)),
      extraLogKey(hoursBefore(nowKey, 2)),
    ])
    .catch(() => [] as (string | null)[]);
  const parsed = past.map((r) => (r ? (JSON.parse(r) as Record<string, number>) : undefined));
  const [xNow, xPrev] = [past[6], past[7]].map((r) => (r ? (JSON.parse(r) as Record<string, (number | null)[]>) : undefined));
  const pastMaps = parsed.slice(0, 4).filter((m): m is Record<string, number> => !!m);
  // 지난주 같은 시각 (weekly·hybrid). parsed[0]이 7일 전
  const lastWeek = parsed[0];
  const [weekBefore, weekAfter] = [parsed[4], parsed[5]];
  const sameKind = isWeekendDay(kst(now).day) === isWeekendDay(kst(new Date(now.getTime() + 24 * 3600_000)).day);
  const night = isNight(Number(t24.slice(11, 13))) ? 1 : 0;
  // 4주 중앙값은 요일×시 프로필에도 넣어 둔다 (한산한 코스가 내일·주말 어느 시간이든 바로 쓸 수 있게). 한 시간에 한 칸씩 채워진다
  const profile = pastMaps.length >= 2 ? await getMedianProfile() : undefined;
  const slot = (() => {
    const d = new Date(Date.parse(`${t24}:00:00Z`));
    return d.getUTCDay() * 24 + d.getUTCHours();
  })();
  const made: Partial<Record<HorizonId, Record<string, number>>> = {};
  const feats: Record<string, LearnRaw> = {};
  const writes: Promise<void>[] = [];
  for (const h of [...HORIZONS.filter((x) => !DERIVED.has(x.id)), ...HORIZONS.filter((x) => DERIVED.has(x.id))]) {
    const tKey = target(h.hours);
    const preds: Record<string, number> = {};
    for (const code of codes) {
      const l = live[code];
      if (h.id === "naive-24h" || h.id === "naive-1h" || h.id === "naive-3h") {
        preds[code] = l.score;
      } else if (h.id === "median-24h") {
        const xs = pastMaps.map((m) => m[code]).filter((x): x is number => typeof x === "number");
        if (xs.length >= 2) {
          preds[code] = median(xs);
          if (profile) (profile[code] ??= Array(168).fill(null))[slot] = preds[code];
        }
      } else if (h.id === "weekly-24h") {
        if (typeof lastWeek?.[code] === "number") preds[code] = lastWeek[code];
      } else if (h.id === "hybrid-24h") {
        preds[code] = !sameKind && typeof lastWeek?.[code] === "number" ? lastWeek[code] : l.score;
      } else if (h.id === "blend-1h" || h.id === "blend-3h") {
        const hz = h.id === "blend-1h" ? "1h" : "3h";
        preds[code] = blendPredict(st.blend[hz], code, l.score, made[`official-${hz}`]?.[code]);
      } else if (h.id === "ensemble-24h") {
        const cands: Partial<Record<EnsCand, number>> = {};
        for (const c of ENS_CANDS) if (typeof made[ENS_H[c]]?.[code] === "number") cands[c] = made[ENS_H[c]]![code];
        const p = ensemblePredict(st.ens[code], cands);
        if (p !== undefined) preds[code] = p;
      } else if (h.id === "learned-24h") {
        const w = lastWeek?.[code];
        const near = [weekBefore?.[code], w, weekAfter?.[code]].filter((x): x is number => typeof x === "number");
        const raw: LearnRaw = [
          l.score,
          typeof w === "number" ? w : null,
          near.length ? Math.round(near.reduce((a, b) => a + b, 0) / near.length) : null,
          made["median-24h"]?.[code] ?? null,
          sameKind ? 0 : 1,
          night,
          ...transitInputs(xNow?.[code], xPrev?.[code]),
        ];
        feats[code] = raw;
        preds[code] = learnPredict(st.rls, raw, st.lb[code]);
      } else if (h.id === "official-1h" || h.id === "official-3h") {
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
    made[h.id] = preds;
    if (Object.keys(preds).length) writes.push(kv.set(predKey(h.id, tKey), JSON.stringify(preds), KEEP_PRED).catch(() => {}));
  }
  if (Object.keys(feats).length) writes.push(kv.set(featKey(t24), JSON.stringify(feats), KEEP_PRED).catch(() => {}));
  if (saveState) writes.push(kv.set(LEARN_KEY, JSON.stringify(st), KEEP_PROFILE).catch(() => {}));
  await Promise.all(writes);
  if (profile && Object.keys(profile).length) await kv.set(PROFILE_KEY, JSON.stringify(profile), KEEP_PROFILE).catch(() => {});
  // 지금 칸(요일×시)에 지금 값을 넣는다 → 내일·주말 예측(lib/route-data)이 지난주·오늘 같은 시각 값을 바로 쓴다
  const week = await getWeekProfile();
  const nowSlot = kst(now).day * 24 + Math.floor(kst(now).hour);
  for (const code of codes) (week[code] ??= Array(168).fill(null))[nowSlot] = live[code].score;
  await kv.set(WEEK_KEY, JSON.stringify(week), KEEP_PROFILE).catch(() => {});
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
