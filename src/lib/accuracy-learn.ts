// 예측을 실제 결과로 매시간 고치는 작은 모델들 (lib/accuracy가 채점 때 고치고 예측 때 쓴다, lib/route-data도 같은 계산). 모두 순수 계산
//   앙상블 ensemble-24h : 지역마다 후보(지금 값·지난주·혼합·4주 중앙값)의 최근 오차(EWMA)를 들고, 오차 제곱에 반비례하게 섞는다
//   학습 모델 learned-24h: 실제 결과로 매시간 스스로 고치는 학습 모델. 지금 값·지난주 같은 시각(앞뒤 1시간 평균)·4주 중앙값에
//                          평일↔주말이 바뀌는지·밤인지를 곱한 선형 모델을 RLS(오래된 결과는 조금씩 잊는 최소제곱)로 한 건씩 고치고,
//                          지역별로 남는 치우침(EWMA)을 더한다
//   단기 혼합 blend-1h/3h: 지역마다 서울시 공식 예측의 치우침(EWMA)을 빼고 지금 값과 섞는다. 섞는 비율은 둘의 최근 오차(제곱 EWMA)로
// 서울 점수는 4값(25·48·68·88)뿐이라 섞은 값은 가장 가까운 값으로 붙인다 (되짚기: 단계 일치·오차 둘 다 좋아짐, 3시간 혼합 70.7→74.4%)
// 상수는 10/21~10/31 실제 값(121곳 × 243시간) 되짚기로 골랐다 (PR 본문 표)

/** 서울시 단계 점수 (lib/seoul-live SEOUL_LEVEL_SCORE 와 같은 값) */
const SEOUL_SCORES = [25, 48, 68, 88];
/** 가장 가까운 서울 단계 점수로 */
export const snapSeoul = (x: number) => SEOUL_SCORES.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), SEOUL_SCORES[0]);
const r3 = (x: number) => Math.round(x * 1000) / 1000;

// ── 앙상블 ──
export const ENS_CANDS = ["naive", "weekly", "hybrid", "median"] as const;
export type EnsCand = (typeof ENS_CANDS)[number];
/** 지역별 후보 오차 (ENS_CANDS 순서, 아직 없으면 null) */
export type EnsErr = (number | null)[];
export const ENS_ALPHA = 0.05;
/** 처음 보는 후보의 오차 (점수) — 지금 값 그대로의 평균 오차쯤 */
const ENS_PRIOR = 6;
/** 오차가 0에 가까워도 한 후보가 전부 가져가지 않게 */
const ENS_EPS = 4;

/** 후보별 섞는 비율 (있는 후보만, 합 1) */
export function ensembleWeights(err: EnsErr | undefined, cands: Partial<Record<EnsCand, number>>): Partial<Record<EnsCand, number>> {
  const raw: Partial<Record<EnsCand, number>> = {};
  let sum = 0;
  ENS_CANDS.forEach((c, i) => {
    if (typeof cands[c] !== "number") return;
    const e = err?.[i] ?? ENS_PRIOR;
    sum += raw[c] = 1 / (e * e + ENS_EPS);
  });
  for (const c of ENS_CANDS) if (raw[c] !== undefined) raw[c] = raw[c]! / sum;
  return raw;
}

export function ensemblePredict(err: EnsErr | undefined, cands: Partial<Record<EnsCand, number>>): number | undefined {
  const w = ensembleWeights(err, cands);
  const ks = ENS_CANDS.filter((c) => w[c] !== undefined);
  return ks.length ? snapSeoul(ks.reduce((a, c) => a + w[c]! * cands[c]!, 0)) : undefined;
}

/** 실제 값이 들어오면 후보마다 절댓값 오차 EWMA를 고친다 (새 배열) */
export function ensembleUpdate(err: EnsErr | undefined, cands: Partial<Record<EnsCand, number>>, actual: number, alpha = ENS_ALPHA): EnsErr {
  return ENS_CANDS.map((c, i) => {
    const prev = err?.[i] ?? null;
    if (typeof cands[c] !== "number") return prev;
    const e = Math.abs(cands[c]! - actual);
    return r3(prev === null ? e : prev + alpha * (e - prev));
  });
}

// ── 학습 모델 (RLS) ──
/** 예측 때 남겨 두는 입력: [지금 값, 지난주 같은 시각, 지난주 앞뒤 1시간 평균, 4주 중앙값, 평일↔주말 바뀜 0/1, 밤 0/1] (없는 값은 null) */
export type LearnRaw = [number, number | null, number | null, number | null, 0 | 1, 0 | 1];
/** 밤 = 목표 시각 0~6시 (서울은 거의 다 '원활') */
export const isNight = (hour: number) => hour < 7;

/** 입력 → 특징 (점수는 100으로 나눈다). 지난주가 없으면 지금 값, 중앙값이 없으면 지난주로 채운다 */
export function learnFeatures([L, W0, S0, M0, k, n]: LearnRaw): number[] {
  const l = L / 100;
  const w = (W0 ?? L) / 100;
  const s = (S0 ?? W0 ?? L) / 100;
  const m = (M0 ?? W0 ?? L) / 100;
  return [1, l, w, s, m, k, k * l, k * w, n, n * l];
}
export const LEARN_DIM = 10;
/** 한 건마다 잊는 비율 (121곳 × 24시간 ≈ 하루 2,900건 → 기억 약 2만 건 ≈ 1주) */
export const RLS_LAMBDA = 0.99995;
export const LEARN_BIAS_ALPHA = 0.05;

export interface Rls {
  /** 가중치 */
  w: number[];
  /** 역공분산 (d×d를 한 줄로) */
  P: number[];
  /** 고친 횟수 */
  n: number;
}

/** 처음 상태: 지난주 같은 시각 그대로(되짚기에서 가장 잘 맞은 기준선)에서 출발. delta가 작을수록 증거가 쌓여야 움직인다 */
export function rlsInit(d = LEARN_DIM, delta = 0.1): Rls {
  const w = Array(d).fill(0);
  w[2] = 1;
  const P = Array(d * d).fill(0);
  for (let i = 0; i < d; i++) P[i * d + i] = delta;
  return { w, P, n: 0 };
}

export const rlsPredict = (m: Rls, x: number[]) => x.reduce((a, xi, i) => a + xi * m.w[i], 0);

/** 한 건으로 고친다 (m을 바꾼다). k = Px/(λ + xᵀPx), w += k·오차, P = (P − k·xᵀP)/λ */
export function rlsUpdate(m: Rls, x: number[], y: number, lambda = RLS_LAMBDA): Rls {
  const d = x.length;
  const Px = Array.from({ length: d }, (_, i) => x.reduce((a, xj, j) => a + m.P[i * d + j] * xj, 0));
  const denom = lambda + x.reduce((a, xi, i) => a + xi * Px[i], 0);
  if (!(denom > 0) || !Number.isFinite(denom)) return m;
  const k = Px.map((v) => v / denom);
  const e = y - rlsPredict(m, x);
  for (let i = 0; i < d; i++) m.w[i] += k[i] * e;
  // P가 대칭이라 xᵀP = (Px)ᵀ
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) m.P[i * d + j] = (m.P[i * d + j] - k[i] * Px[j]) / lambda;
  m.n++;
  return m;
}

/** 학습 모델 예측 (점수): 공통 모델 + 지역 치우침 */
export const learnPredict = (m: Rls, raw: LearnRaw, bias = 0) => snapSeoul(rlsPredict(m, learnFeatures(raw)) * 100 + bias);

// ── 단기 혼합 ──
export interface BlendState {
  /** 지금 값 그대로의 오차 제곱 EWMA (공통) */
  sL: number;
  /** 치우침을 뺀 공식 예측의 오차 제곱 EWMA (공통) */
  sO: number;
  /** 지역별 공식 예측 치우침 (공식 − 실제) EWMA */
  b: Record<string, number>;
}
export const BLEND_ALPHA = 0.02;
export const BLEND_BIAS_ALPHA = 0.1;
export const blendInit = (): BlendState => ({ sL: 50, sO: 50, b: {} });

/** 지금 값에 줄 비율 (나머지는 치우침을 뺀 공식 예측) */
export const blendWeight = (st: BlendState) => (st.sL + st.sO > 0 ? st.sO / (st.sL + st.sO) : 0.5);

export function blendPredict(st: BlendState, code: string, live: number, official: number | undefined): number {
  if (official === undefined) return live;
  const w = blendWeight(st);
  return snapSeoul(w * live + (1 - w) * (official - (st.b[code] ?? 0)));
}

/** 실제 값으로 고친다 (st를 바꾼다) */
export function blendUpdate(st: BlendState, code: string, live: number, official: number | undefined, actual: number): BlendState {
  st.sL += BLEND_ALPHA * ((live - actual) ** 2 - st.sL);
  if (official === undefined) return st;
  const b = st.b[code] ?? 0;
  st.sO += BLEND_ALPHA * ((official - b - actual) ** 2 - st.sO);
  st.b[code] = r3(b + BLEND_BIAS_ALPHA * (official - actual - b));
  st.sL = r3(st.sL);
  st.sO = r3(st.sO);
  return st;
}

// ── 한 Redis 키에 담는 상태 ──
export interface LearnState {
  v: 1;
  /** 마지막으로 고친 목표 시각 */
  at?: string;
  ens: Record<string, EnsErr>;
  rls: Rls;
  /** 학습 모델 지역 치우침 (실제 − 예측, 점수) */
  lb: Record<string, number>;
  blend: { "1h": BlendState; "3h": BlendState };
}
export const learnInit = (): LearnState => ({ v: 1, ens: {}, rls: rlsInit(), lb: {}, blend: { "1h": blendInit(), "3h": blendInit() } });

/** 지역 하나의 24시간 학습 모델 예측 한 건을 실제 값으로 고친다 (st를 바꾼다). 지난주 값이 없던 예측은 채운 값이라 배우지 않는다 */
export function learnUpdate(st: LearnState, code: string, raw: LearnRaw, actual: number): void {
  if (raw[1] === null) return;
  const x = learnFeatures(raw);
  const pred = rlsPredict(st.rls, x) * 100;
  const b = st.lb[code] ?? 0;
  st.lb[code] = r3(b + LEARN_BIAS_ALPHA * (actual - pred - b));
  rlsUpdate(st.rls, x, actual / 100);
}
