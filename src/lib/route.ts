// 추천 루트: 출발지·시간·관심사에 맞춰 장소를 고르고, 도착 시각의 예상 혼잡과 이동시간이 가장 적은 순서를 찾는다.
// 순수 계산만 한다 (데이터는 lib/route-data.ts). 설계: docs/PLATFORM-DESIGN.md 5장
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
  /** 시(0~23) → 예상 혼잡 점수. 예측이 없는 시간은 now로 */
  hourly: Record<number, number>;
  now?: number;
  /** 운영 시간 [시작, 끝] (시, 소수 가능). 없으면 늘 열림 */
  hours?: [number, number];
  /** 데이터 출처 (화면 표시) */
  basis: "seoul" | "place";
}

export interface RouteRequest {
  start: LatLng & { name: string };
  /** 출발 시각 (자정부터 분, KST) */
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
  score: number;
  /** 오늘 이 장소가 가장 붐비는 시각과 점수 (피했다는 설명용) */
  peak?: { hour: number; score: number };
  basis: Candidate["basis"];
}

export interface RoutePlan {
  stops: RouteStop[];
  /** 방문 시각 기준 평균 예상 혼잡 */
  avgScore: number;
  /** 같은 장소를 각자 가장 붐비는 시간에 갔다면의 평균 (비교용) */
  peakAvgScore: number;
  totalTravelMin: number;
  endMin: number;
}

const CROWD_W = 1; // 혼잡 1점 = 비용 1
const TRAVEL_W = 0.8; // 이동 1분 = 비용 0.8
const MIN_GAP_KM = 0.6; // 서로 600m 안의 장소는 한 코스에 하나만 (겹치는 동네)

function scoreAt(c: Candidate, minute: number): number {
  const h = Math.floor(minute / 60) % 24;
  return c.hourly[h] ?? c.now ?? 50;
}

function isOpen(c: Candidate, arrive: number, leave: number): boolean {
  if (!c.hours) return true;
  const [o, cl] = c.hours;
  return arrive >= o * 60 && leave <= cl * 60;
}

/** 정해진 순서로 돌았을 때 일정과 비용. 시간이 넘치거나 문을 닫으면 null */
function simulate(order: Candidate[], req: RouteRequest): { stops: RouteStop[]; cost: number } | null {
  let pos: LatLng = req.start;
  let t = req.startMin;
  const end = req.startMin + req.durationMin;
  const stops: RouteStop[] = [];
  let cost = 0;
  for (const c of order) {
    const tr = travelMinutes(pos, c, req.transport);
    const arrive = t + tr.minutes;
    const leave = arrive + c.stay;
    if (leave > end || !isOpen(c, arrive, leave)) return null;
    const score = scoreAt(c, arrive);
    cost += score * CROWD_W + tr.minutes * TRAVEL_W;
    const peakEntry = Object.entries(c.hourly).sort((a, b) => b[1] - a[1])[0];
    stops.push({
      id: c.id,
      name: c.name,
      href: c.href,
      lat: c.lat,
      lng: c.lng,
      arrive,
      leave,
      travelMin: tr.minutes,
      travelKm: tr.km,
      walk: tr.walk,
      score,
      peak: peakEntry ? { hour: Number(peakEntry[0]), score: peakEntry[1] } : undefined,
      basis: c.basis,
    });
    pos = c;
    t = leave;
  }
  return { stops, cost };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]));
}

export function planRoute(all: Candidate[], req: RouteRequest): RoutePlan {
  const radiusKm = req.transport === "walk" ? 3.5 : 15;
  const pool = all.filter((c) => req.interests.includes(c.interest) && distanceKm(req.start, c) <= radiusKm);

  // 1) 욕심쟁이로 고르기: 지금 위치에서 (도착 시각 혼잡 + 이동시간) 비용이 가장 낮은 곳을 하나씩
  const chosen: Candidate[] = [];
  let pos: LatLng = req.start;
  let t = req.startMin;
  const end = req.startMin + req.durationMin;
  for (;;) {
    let best: { c: Candidate; cost: number; leave: number } | undefined;
    for (const c of pool) {
      if (chosen.includes(c) || chosen.some((x) => distanceKm(x, c) < MIN_GAP_KM)) continue;
      // 관심사가 여러 개면 같은 종류만 이어지지 않게 (직전과 같은 관심사면 약간 손해)
      const repeat = chosen.length > 0 && chosen[chosen.length - 1].interest === c.interest && req.interests.length > 1 ? 8 : 0;
      const tr = travelMinutes(pos, c, req.transport);
      const arrive = t + tr.minutes;
      const leave = arrive + c.stay;
      if (leave > end || !isOpen(c, arrive, leave)) continue;
      const cost = scoreAt(c, arrive) * CROWD_W + tr.minutes * TRAVEL_W + repeat;
      if (!best || cost < best.cost) best = { c, cost, leave };
    }
    if (!best) break;
    chosen.push(best.c);
    pos = best.c;
    t = best.leave;
    if (chosen.length >= 6) break;
  }

  // 2) 고른 곳의 방문 순서를 모두 비교해 비용이 가장 낮은 순서 (6곳 = 720가지)
  let bestRun = simulate(chosen, req);
  for (const order of permutations(chosen)) {
    const run = simulate(order, req);
    if (run && (!bestRun || run.cost < bestRun.cost)) bestRun = run;
  }
  const stops = bestRun?.stops ?? [];
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : 0);
  return {
    stops,
    avgScore: avg(stops.map((s) => s.score)),
    peakAvgScore: avg(stops.map((s) => s.peak?.score ?? s.score)),
    totalTravelMin: stops.reduce((s, x) => s + x.travelMin, 0),
    endMin: stops.at(-1)?.leave ?? req.startMin,
  };
}
