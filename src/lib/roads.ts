// 진입로 소통 (국가교통정보센터 ITS 오픈API, ITS_API_KEY): 장소 둘레 네모 안의 도로 구간 실시간 속도.
// - 주변 도로(국도·지방도·시내 도로, type=its): 장소에서 약 2km 안
// - 가까운 고속도로(type=ex): 약 6km 안 (나들목·진입 구간이 걸리게)
// 구간마다 속도로 원활·서행·정체를 나누고, 막히는 구간 비율로 전체 상태를 정한다. 5분 저장(모든 서버 공유), 실패하면 마지막 값
import { APIS, beforeCall } from "./api-quota";
import { cached } from "./cached";
import { fixtureMode, loadFixture } from "./fixtures";

export type RoadLevel = "원활" | "서행" | "정체";

export interface RoadGroup {
  /** 속도 자료가 있는 구간 수 */
  links: number;
  /** 구간 평균 속도 (km/h) */
  avgSpeed: number;
  /** 서행·정체 구간 비율 (0~1) */
  slowShare: number;
  level: RoadLevel;
  /** 가장 느린 도로 (이름별 가장 느린 구간, 최대 3개) */
  slowest: { road: string; speed: number }[];
}

export interface RoadStatus {
  local?: RoadGroup;
  highway?: RoadGroup;
  /** ITS 자료 시각 (한국 시간 HH:mm) */
  time?: string;
}

/** 구간 속도 → 단계. 고속도로는 기준이 더 높다 */
const LIMITS = { local: { jam: 15, slow: 30 }, highway: { jam: 40, slow: 70 } } as const;

interface Link {
  roadName?: string;
  speed?: string | number;
  createdDate?: string;
}

async function fetchLinks(type: "its" | "ex", lat: number, lng: number, half: number): Promise<{ items: Link[] }> {
  if (fixtureMode()) {
    const fx = loadFixture<Record<string, Link[]>>("its-traffic");
    if (!fx) throw new Error("its fixture 없음");
    return { items: fx[type] ?? [] };
  }
  const key = process.env.ITS_API_KEY;
  if (!key) throw new Error("ITS_API_KEY 미설정");
  await beforeCall(APIS.find((a) => a.id === "its-traffic"));
  const qs = new URLSearchParams({
    apiKey: key,
    type,
    drcType: "all",
    minX: (lng - half * 1.25).toFixed(5),
    maxX: (lng + half * 1.25).toFixed(5),
    minY: (lat - half).toFixed(5),
    maxY: (lat + half).toFixed(5),
    getType: "json",
  });
  const res = await fetch(`https://openapi.its.go.kr:9443/trafficInfo?${qs}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`its ${res.status}`);
  const j = (await res.json()) as { header?: { resultCode?: number; resultMsg?: string }; body?: { items?: Link[] } };
  if (j.header?.resultCode !== undefined && j.header.resultCode !== 0) throw new Error(`its ${j.header.resultMsg}`);
  return { items: j.body?.items ?? [] };
}

/** 구간 목록 → 요약 (속도가 0이거나 말이 안 되는 값은 뺀다) */
export function summarize(items: Link[], kind: "local" | "highway"): RoadGroup | undefined {
  const lim = LIMITS[kind];
  const rows = items
    .map((i) => ({ road: String(i.roadName ?? "").trim(), speed: Number(i.speed) }))
    .filter((r) => Number.isFinite(r.speed) && r.speed > 0 && r.speed <= 200);
  if (rows.length < 3) return undefined;
  const avgSpeed = Math.round(rows.reduce((a, r) => a + r.speed, 0) / rows.length);
  const jam = rows.filter((r) => r.speed < lim.jam).length / rows.length;
  const slowShare = rows.filter((r) => r.speed < lim.slow).length / rows.length;
  const level: RoadLevel = jam >= 0.3 || avgSpeed < lim.jam ? "정체" : slowShare >= 0.35 || avgSpeed < lim.slow ? "서행" : "원활";
  const byRoad = new Map<string, number>();
  for (const r of rows) if (r.road) byRoad.set(r.road, Math.min(byRoad.get(r.road) ?? Infinity, r.speed));
  const slowest = [...byRoad]
    .filter(([, s]) => s < lim.slow)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([road, speed]) => ({ road, speed: Math.round(speed) }));
  return { links: rows.length, avgSpeed, slowShare: Math.round(slowShare * 100) / 100, level, slowest };
}

/** "20261021091500" 등 → "09:15" */
const hhmm = (v?: string) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 12 ? `${d.slice(8, 10)}:${d.slice(10, 12)}` : undefined;
};

/** 장소 둘레 도로 소통. 키가 없거나 자료가 모자라면 undefined */
export async function getRoadStatus(lat: number, lng: number): Promise<RoadStatus | undefined> {
  if (!process.env.ITS_API_KEY && !fixtureMode()) return undefined;
  const key = `road:${fixtureMode() ? `fx-${fixtureMode()}:` : ""}${lat.toFixed(3)},${lng.toFixed(3)}`;
  try {
    const [local, highway] = await Promise.all([
      cached(`${key}:its`, 300, () => fetchLinks("its", lat, lng, 0.018), (v) => v.items.length === 0).catch(() => ({ items: [] as Link[] })),
      cached(`${key}:ex`, 300, () => fetchLinks("ex", lat, lng, 0.055), (v) => v.items.length === 0).catch(() => ({ items: [] as Link[] })),
    ]);
    const out: RoadStatus = {
      local: summarize(local.items, "local"),
      highway: summarize(highway.items, "highway"),
      time: hhmm([...local.items, ...highway.items].map((i) => i.createdDate ?? "").sort().at(-1)),
    };
    return out.local || out.highway ? out : undefined;
  } catch {
    return undefined;
  }
}
