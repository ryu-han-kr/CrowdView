// 지하철 이동시간 (서버 전용): src/data/seoul/subway.json 노선망에서 가장 빠른 길을 찾는다 (다익스트라).
// 출발 → 가까운 역까지 걷기 + 기다림 → 타고 가기(갈아타기 포함) → 내린 역에서 걷기. 길찾기 API를 쓰지 않아 호출 비용 0
import subway from "@/data/seoul/subway.json";
import { distanceKm, type LatLng } from "./geo";

const WALK_KMH = 4.5;
const DETOUR = 1.3; // 걷는 길은 직선보다 30% 길다
const WAIT_MIN = 4; // 역까지 내려가기 + 열차 기다리기
const TRANSFER_MIN = 4; // 갈아타기 (걷기 + 기다리기)
const ACCESS_KM = 1.2; // 이보다 먼 역은 걸어가지 않는다
const ACCESS_MAX = 4; // 가까운 역 몇 곳까지 비교할지

const data = subway as { l: string[]; s: [string, number, number][]; e: [number, number, number, number, number][] };
const walkMin = (km: number) => ((km * DETOUR) / WALK_KMH) * 60;

// 노드 = (역, 노선). 같은 역의 다른 노선 노드끼리는 갈아타기로 잇는다
const nodeStation: number[] = [];
const nodeLine: number[] = [];
const nodeOf = new Map<string, number>();
const adj: { to: number; min: number; km: number }[][] = [];
function node(s: number, l: number): number {
  const key = `${s}|${l}`;
  let n = nodeOf.get(key);
  if (n === undefined) {
    n = nodeStation.push(s) - 1;
    nodeLine.push(l);
    nodeOf.set(key, n);
    adj.push([]);
  }
  return n;
}
for (const [a, b, min, km, l] of data.e) {
  const na = node(a, l);
  const nb = node(b, l);
  adj[na].push({ to: nb, min, km });
  adj[nb].push({ to: na, min, km });
}
const stationNodes: number[][] = data.s.map(() => []);
nodeStation.forEach((s, n) => stationNodes[s].push(n));
for (const ns of stationNodes) for (const a of ns) for (const b of ns) if (a !== b) adj[a].push({ to: b, min: TRANSFER_MIN, km: 0 });

interface Tree {
  min: Float64Array;
  km: Float64Array;
  prev: Int32Array;
}
const trees = new Map<number, Tree>();

/** 한 역에서 모든 노드까지 가장 빠른 시간 (역마다 한 번만 계산해 둔다) */
function treeFrom(station: number): Tree {
  const hit = trees.get(station);
  if (hit) return hit;
  const N = nodeStation.length;
  const t: Tree = { min: new Float64Array(N).fill(Infinity), km: new Float64Array(N), prev: new Int32Array(N).fill(-1) };
  const heap: [number, number][] = [];
  const push = (d: number, n: number) => {
    heap.push([d, n]);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  for (const n of stationNodes[station]) {
    t.min[n] = 0;
    push(0, n);
  }
  while (heap.length) {
    const [d, n] = pop();
    if (d > t.min[n]) continue;
    for (const e of adj[n]) {
      const nd = d + e.min;
      if (nd < t.min[e.to]) {
        t.min[e.to] = nd;
        t.km[e.to] = t.km[n] + e.km;
        t.prev[e.to] = n;
        push(nd, e.to);
      }
    }
  }
  if (trees.size > 400) trees.clear(); // 메모리 상한 (역 수가 635개라 거의 닿지 않는다)
  trees.set(station, t);
  return t;
}

function nearStations(p: LatLng): { s: number; km: number }[] {
  const out: { s: number; km: number }[] = [];
  data.s.forEach(([, lat, lng], s) => {
    const km = distanceKm(p, { lat, lng });
    if (km <= ACCESS_KM) out.push({ s, km });
  });
  return out.sort((a, b) => a.km - b.km).slice(0, ACCESS_MAX);
}

export interface SubwayTrip {
  minutes: number;
  /** 걷기 + 타고 가는 거리 */
  km: number;
  /** 탄 노선 순서 (예: ["2호선", "5호선"]) */
  lines: string[];
  from: string;
  to: string;
}

/** 두 지점 사이 지하철 이동. 어느 한쪽 1.2km 안에 역이 없거나 같은 역이면 null */
export function subwayTrip(a: LatLng, b: LatLng): SubwayTrip | null {
  const A = nearStations(a);
  const B = nearStations(b);
  let best: { total: number; sa: number; node: number; walkKm: number } | undefined;
  for (const sa of A) {
    const tree = treeFrom(sa.s);
    for (const sb of B) {
      if (sb.s === sa.s) continue;
      for (const n of stationNodes[sb.s]) {
        const total = walkMin(sa.km) + WAIT_MIN + tree.min[n] + walkMin(sb.km);
        if (Number.isFinite(total) && (!best || total < best.total)) best = { total, sa: sa.s, node: n, walkKm: (sa.km + sb.km) * DETOUR };
      }
    }
  }
  if (!best) return null;
  const tree = treeFrom(best.sa);
  const lines: string[] = [];
  for (let n = best.node; n >= 0; n = tree.prev[n]) {
    const l = data.l[nodeLine[n]];
    if (lines[0] !== l && tree.prev[n] >= 0) lines.unshift(l);
  }
  return {
    minutes: Math.round(best.total),
    km: Math.round((best.walkKm + tree.km[best.node]) * 10) / 10,
    lines,
    from: data.s[best.sa][0],
    to: data.s[nodeStation[best.node]][0],
  };
}
