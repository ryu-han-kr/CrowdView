// 추천 루트: 출발지·시간·관심사에 맞춰 장소를 고르고, 도착 시각의 예상 혼잡과 이동시간이 가장 적은 순서를 찾는다.
// 일정이 점심(11:30~13:30)·저녁(17:30~19:30)에 걸치면 그 시간에 근처 맛집을 끼워 넣는다.
// 순수 계산만 한다 (데이터·지하철 이동시간은 lib/route-data.ts). 설계: docs/PLATFORM-DESIGN.md 5장
import { distanceKm, travelMinutes, type LatLng, type Transport } from "./geo";

/** 관심사 (화면 칩) */
export type Interest = "history" | "nature" | "shopping" | "fun";
export const INTERESTS: { id: Interest; label: string; emoji: string }[] = [
  { id: "history", label: "역사·문화", emoji: "🏯" },
  { id: "nature", label: "공원·자연", emoji: "🌳" },
  { id: "shopping", label: "거리·쇼핑", emoji: "🛍️" },
  { id: "fun", label: "놀이·체험", emoji: "🎢" },
];

export interface Candidate extends LatLng {
  id: string;
  name: string;
  href: string;
  interest: Interest;
  /** 머무는 시간 (분) */
  stay: number;
  /** 오늘 0시부터 센 시(내일 9시 = 33) → 실시간·예측 점수 */
  hourly: Record<number, number>;
  /** hourly에 없는 시간대의 예측 (내일·주말: 지하철 승하차 모양 등). 없으면 now */
  predict?: (absHour: number) => number;
  now?: number;
  /** 운영 시간 [시작, 끝] (시, 소수 가능). 없으면 늘 열림 */
  hours?: [number, number];
  /** 데이터 출처 (화면 표시) */
  basis: "seoul" | "place";
  /** 사진 (화면 표시) */
  img?: string;
}

/** 식사 장소 후보 (서울 여행 가이드 맛집) */
export interface MealSpot extends LatLng {
  id: string;
  name: string;
  href: string;
  img?: string;
}

/** 한 구간 이동 */
export interface Leg {
  minutes: number;
  km: number;
  walk: boolean;
  /** 지하철로 가면 탄 노선 순서 (예: ["3호선", "2호선"]) */
  lines?: string[];
}
export type TravelFn = (a: LatLng, b: LatLng, mode: Transport) => Leg;

export interface RouteRequest {
  start: LatLng & { name: string };
  /** 출발 시각 (오늘 자정부터 분, KST. 내일 9시 = 1980) */
  startMin: number;
  durationMin: number;
  interests: Interest[];
  transport: Transport;
}

export interface RouteStop {
  id: string;
  name: string;
  href: string;
  lat: number;
  lng: number;
  arrive: number;
  leave: number;
  travelMin: number;
  travelKm: number;
  walk: boolean;
  lines?: string[];
  score: number;
  /** 식사 들르기면 점심·저녁 (혼잡 점수 없음) */
  meal?: "lunch" | "dinner";
  /** 이용자가 ☆로 담은 곳 */
  picked?: boolean;
  /** 실시간·12시간 예측이 아니라 평소 패턴으로 본 예측 점수 */
  predicted?: boolean;
  /** 그날(9~21시) 가장 한산한 시간대에 도착하면 true (이유 설명용) */
  calm?: boolean;
  /** 문 열 때까지 기다린 시간 (분) */
  waitMin?: number;
  /** 오늘 이 장소가 가장 붐비는 시각과 점수 (피했다는 설명용) */
  peak?: { hour: number; score: number };
  basis: Candidate["basis"];
  img?: string;
}

export interface RoutePlan {
  stops: RouteStop[];
  /** 방문 시각 기준 평균 예상 혼잡 (식사 제외) */
  avgScore: number;
  /** 같은 장소를 각자 가장 붐비는 시간에 갔다면의 평균 (비교용) */
  peakAvgScore: number;
  totalTravelMin: number;
  endMin: number;
  /** 담았지만 시간·운영 시간이 안 맞아 못 넣은 곳 (이름) */
  missedPicks?: string[];
}

const CROWD_W = 1; // 혼잡 1점 = 비용 1
const TRAVEL_W = 0.8; // 이동 1분 = 비용 0.8
const MIN_GAP_KM = 0.6; // 서로 600m 안의 장소는 한 코스에 하나만 (겹치는 동네)
const MEAL_MISS = 30; // 식사 시간을 놓치는 순서의 벌점
const MEAL_KM = 1.2; // 이보다 먼 맛집은 고르지 않는다
const MAX_STOPS = 6; // 순서를 모두 비교하는 상한 (6곳 = 720가지)
const MAX_WAIT = 90; // 문 열 때까지 기다리는 최대 시간 (분)
const WAIT_W = 0.4; // 기다림 1분 = 비용 0.4 (이동보다 덜 아깝지만 공짜는 아님)

/**
 * 식사를 시작하는 시각 (자정부터 분). 1시간 먹는다고 보고 점심 11:20~12:40, 저녁 17:20~18:40 사이에 시작한다.
 * 다음 장소에 가면 식사 시간을 통째로 넘기는 경우엔 early 분 일찍 먹는다
 */
const MEALS = [
  { kind: "lunch" as const, from: 11 * 60 + 20, to: 12 * 60 + 40, early: 50, stay: 60 },
  { kind: "dinner" as const, from: 17 * 60 + 20, to: 18 * 60 + 40, early: 50, stay: 60 },
];
type Meal = (typeof MEALS)[number];

function scoreAt(c: Candidate, minute: number): { score: number; predicted: boolean } {
  const h = Math.floor(minute / 60);
  const known = c.hourly[h];
  if (known !== undefined) return { score: known, predicted: false };
  const p = c.predict?.(h);
  return p !== undefined ? { score: p, predicted: true } : { score: c.now ?? 50, predicted: false };
}

/** 그날 가장 붐비는 시각 (피했다는 설명용) */
/** 그날 9~21시 중 가장 한산한 시 */
function calmestHour(c: Candidate, minute: number): number | undefined {
  const day = Math.floor(minute / 1440) * 24;
  let best: { hour: number; score: number } | undefined;
  for (let h = day + 9; h <= day + 21; h++) {
    const v = c.hourly[h] ?? c.predict?.(h);
    if (v !== undefined && (!best || v < best.score)) best = { hour: h, score: v };
  }
  return best?.hour;
}

function peakOfDay(c: Candidate, minute: number): { hour: number; score: number } | undefined {
  const day = Math.floor(minute / 1440) * 24;
  let best: { hour: number; score: number } | undefined;
  for (let h = day + 7; h < day + 23; h++) {
    const known = c.hourly[h] ?? c.predict?.(h);
    if (known !== undefined && (!best || known > best.score)) best = { hour: h % 24, score: known };
  }
  return best;
}

function isOpen(c: Candidate, arrive: number, leave: number): boolean {
  if (!c.hours) return true;
  const [o, cl] = c.hours;
  const day = Math.floor(arrive / 1440) * 1440;
  return arrive >= day + o * 60 && leave <= day + cl * 60;
}

interface State {
  pos: LatLng;
  t: number;
  stops: RouteStop[];
  cost: number;
  /** 아직 먹지 않은 끼니 (시간 순) */
  meals: Meal[];
}

/** 코스 하나를 따라가며 이동·식사·방문을 쌓는다. 욕심쟁이 고르기와 순서 비교가 같은 규칙을 쓴다 */
function makePlanner(req: RouteRequest, travel: TravelFn, spots: MealSpot[], mustIds: Set<string>) {
  const end = req.startMin + req.durationMin;
  const dayBase = Math.floor(req.startMin / 1440) * 1440;
  const meals = MEALS.map((m) => ({ ...m, from: m.from + dayBase, to: m.to + dayBase }));
  const legMemo = new Map<string, Leg>();
  const leg = (a: LatLng, b: LatLng) => {
    const key = `${a.lat},${a.lng}>${b.lat},${b.lng}`;
    let l = legMemo.get(key);
    if (!l) legMemo.set(key, (l = travel(a, b, req.transport)));
    return l;
  };
  const spotMemo = new Map<string, MealSpot[]>();
  /** 가까운 맛집 (이미 들른 곳은 빼고) */
  const nearestSpot = (p: LatLng, used: RouteStop[]) => {
    const key = `${p.lat},${p.lng}`;
    let near = spotMemo.get(key);
    if (!near) {
      near = spots
        .map((s) => ({ s, d: distanceKm(p, s) }))
        .filter((x) => x.d <= MEAL_KM)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map((x) => x.s);
      spotMemo.set(key, near);
    }
    return near.find((s) => !used.some((u) => u.id === s.id));
  };
  const miss = (s: State): State => ({ ...s, meals: s.meals.slice(1), cost: s.cost + MEAL_MISS });

  const initial = (): State => ({
    pos: req.start,
    t: req.startMin,
    stops: [],
    cost: 0,
    // 일정 안에 식사 시간이 들어오는 끼니만 (출발하는 날 기준)
    meals: spots.length ? meals.filter((m) => req.startMin <= m.to && end >= m.from + m.stay) : [],
  });

  /** 먹을 때가 됐으면 근처 맛집에 들른다. 아니면 그대로 돌려준다. nextLeave: 다음 장소를 지금 가면 떠나는 시각 */
  function eat(s: State, nextLeave?: number): State {
    const m = s.meals[0];
    if (!m) return s;
    const due = s.t >= m.from || (nextLeave !== undefined && s.t >= m.from - m.early && nextLeave > m.to);
    if (!due) return s;
    const spot = s.t <= m.to ? nearestSpot(s.pos, s.stops) : undefined;
    if (!spot) return miss(s);
    const l = leg(s.pos, spot);
    const arrive = s.t + l.minutes;
    const leave = arrive + m.stay;
    if (leave > end) return miss(s);
    const stop: RouteStop = {
      id: spot.id,
      name: spot.name,
      href: spot.href,
      lat: spot.lat,
      lng: spot.lng,
      arrive,
      leave,
      travelMin: l.minutes,
      travelKm: l.km,
      walk: l.walk,
      ...(l.lines && { lines: l.lines }),
      score: 0,
      meal: m.kind,
      basis: "place",
      ...(spot.img && { img: spot.img }),
    };
    return { pos: spot, t: leave, stops: [...s.stops, stop], cost: s.cost + l.minutes * TRAVEL_W, meals: s.meals.slice(1) };
  }

  /** 장소 c에 들른다 (때가 되면 그 전에 식사). 시간이 넘치거나 문을 닫으면 null */
  function visit(s0: State, c: Candidate): State | null {
    let s = s0;
    for (let i = 0; i < MEALS.length; i++) {
      const next = eat(s, s.t + leg(s.pos, c).minutes + c.stay);
      if (next === s) break;
      s = next;
    }
    const l = leg(s.pos, c);
    // 문 열기 전에 도착하면 90분 안쪽은 기다렸다 들어간다 (예: 내일 9시 출발, 10시 개장)
    const reach = s.t + l.minutes;
    const opensAt = c.hours ? Math.floor(reach / 1440) * 1440 + c.hours[0] * 60 : reach;
    const wait = opensAt > reach && opensAt - reach <= MAX_WAIT ? opensAt - reach : 0;
    const arrive = reach + wait;
    const leave = arrive + c.stay;
    if (leave > end || !isOpen(c, arrive, leave)) return null;
    const { score, predicted } = scoreAt(c, arrive);
    const stop: RouteStop = {
      id: c.id,
      name: c.name,
      href: c.href,
      lat: c.lat,
      lng: c.lng,
      arrive,
      leave,
      travelMin: l.minutes,
      travelKm: l.km,
      walk: l.walk,
      ...(l.lines && { lines: l.lines }),
      score,
      peak: peakOfDay(c, arrive),
      ...(calmestHour(c, arrive) === Math.floor(arrive / 60) && { calm: true }),
      ...(wait > 0 && { waitMin: wait }),
      basis: c.basis,
      ...(c.img && { img: c.img }),
      ...(mustIds.has(c.id) && { picked: true }),
      ...(predicted && { predicted: true }),
    };
    const after: State = { ...s, pos: c, t: leave, stops: [...s.stops, stop], cost: s.cost + score * CROWD_W + l.minutes * TRAVEL_W + wait * WAIT_W };
    // 여기 있는 동안 식사 시간이 지나 버리면 바로 벌점 (욕심쟁이 고르기가 미리 알 수 있게)
    return after.meals[0] && leave > after.meals[0].to ? miss(after) : after;
  }

  /** 마지막 장소 뒤에 남은 끼니: 곧 식사 시간이면 기다렸다 먹고, 아니면 놓친 것으로 */
  function finish(s0: State): State {
    let s = s0;
    while (s.meals.length) {
      const m = s.meals[0];
      s = s.t >= m.from - m.early ? eat({ ...s, t: Math.max(s.t, m.from) }) : miss(s);
    }
    return s;
  }

  return { initial, visit, finish };
}

type Planner = ReturnType<typeof makePlanner>;

/** 정해진 순서로 돌았을 때 일정과 비용. 시간이 넘치거나 문을 닫으면 null */
function simulate(order: Candidate[], planner: Planner): State | null {
  let s = planner.initial();
  for (const c of order) {
    const next = planner.visit(s, c);
    if (!next) return null;
    s = next;
  }
  return planner.finish(s);
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]));
}

/**
 * travel: 구간 이동시간 (서버는 지하철 노선망, 없으면 직선거리 어림)
 * meals: 식사 장소 후보 (없으면 식사를 넣지 않는다)
 * must: 이용자가 담은 곳. 관심사·거리와 상관없이 먼저 넣고, 남는 시간에 다른 곳을 고른다
 * exclude: 빼고 짤 장소 id (다시 짜기: 이미 들른 곳)
 */
export function planRoute(
  all: Candidate[],
  req: RouteRequest,
  opts: { travel?: TravelFn; meals?: MealSpot[]; must?: Candidate[]; exclude?: string[] } = {},
): RoutePlan {
  const radiusKm = req.transport === "walk" ? 3.5 : 15;
  const must = (opts.must ?? []).slice(0, MAX_STOPS);
  const mustIds = new Set(must.map((c) => c.id));
  // exclude: 다시 짤 때 이미 들른 곳
  const skip = new Set(opts.exclude ?? []);
  const pool = all.filter((c) => !mustIds.has(c.id) && !skip.has(c.id) && req.interests.includes(c.interest) && distanceKm(req.start, c) <= radiusKm);
  const spots = (opts.meals ?? []).filter((m) => distanceKm(req.start, m) <= radiusKm + MEAL_KM);
  const planner = makePlanner(req, opts.travel ?? travelMinutes, spots, mustIds);

  // 1) 욕심쟁이로 고르기: 지금 위치에서 (도착 시각 혼잡 + 이동시간 + 식사 벌점) 비용이 가장 낮은 곳을 하나씩.
  //    담은 곳이 있으면 그중에서 먼저 (시간 안에 들어가는 만큼), 그다음 나머지 후보에서
  const chosen: Candidate[] = [];
  let state = planner.initial();
  for (const [from, repeatPenalty] of [
    [must, false],
    [pool, true],
  ] as const) {
    while (chosen.length < MAX_STOPS) {
      let best: { c: Candidate; cost: number; next: State } | undefined;
      for (const c of from) {
        if (chosen.includes(c) || chosen.some((x) => distanceKm(x, c) < MIN_GAP_KM && !(mustIds.has(x.id) && mustIds.has(c.id)))) continue;
        // 관심사가 여러 개면 같은 종류만 이어지지 않게 (직전과 같은 관심사면 약간 손해)
        const repeat = repeatPenalty && chosen.length > 0 && chosen[chosen.length - 1].interest === c.interest && req.interests.length > 1 ? 8 : 0;
        const next = planner.visit(state, c);
        if (!next) continue;
        const cost = next.cost - state.cost + repeat;
        if (!best || cost < best.cost) best = { c, cost, next };
      }
      if (!best) break;
      chosen.push(best.c);
      state = best.next;
    }
  }
  const missedPicks = must.filter((c) => !chosen.includes(c)).map((c) => c.name);

  // 2) 고른 곳의 방문 순서를 모두 비교해 비용이 가장 낮은 순서 (6곳 = 720가지)
  let bestRun = simulate(chosen, planner);
  for (const order of permutations(chosen)) {
    const run = simulate(order, planner);
    if (run && (!bestRun || run.cost < bestRun.cost)) bestRun = run;
  }
  const stops = bestRun?.stops ?? [];
  const sights = stops.filter((s) => !s.meal);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : 0);
  return {
    stops,
    avgScore: avg(sights.map((s) => s.score)),
    peakAvgScore: avg(sights.map((s) => s.peak?.score ?? s.score)),
    totalTravelMin: stops.reduce((s, x) => s + x.travelMin, 0),
    endMin: stops.at(-1)?.leave ?? req.startMin,
    ...(missedPicks.length && { missedPicks }),
  };
}
