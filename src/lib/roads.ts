// 가는 길 도로 상황: 장소 둘레 도로 구간의 실시간 속도로 원활·서행·정체를 나눈다.
// - 주변 도로: 서울 실시간 지역(1.5km 안)이면 서울시 도시데이터의 도로 소통(지역 상세와 같은 자료), 아니면 국가교통정보센터(ITS_API_KEY)
//   국가교통정보센터는 운영 서버(Vercel)에서 접속 자체가 안 돼(UND_ERR_CONNECT_TIMEOUT, 10/21) 한 번 막히면 1시간 쉬고 다시 해 본다
// - 가까운 고속도로: 한국도로공사(EX_API_KEY) 실시간 콘존(나들목 사이 구간) 속도. 콘존 이름의 양 끝 나들목을 영업소 좌표에 맞춰 장소 8km 안만
// 구간마다 속도로 단계를 나누고, 막히는 구간 비율로 전체 상태를 정한다. 장소마다 5분 저장(모든 서버 공유), 실패하면 마지막 값
import { APIS, beforeCall } from "./api-quota";
import { kv } from "./cache";
import { cached } from "./cached";
import { fixtureMode, loadFixture } from "./fixtures";
import { distanceKm, type LatLng } from "./geo";
import { SEOUL_AREAS } from "./seoul-areas";
import { getSeoulAreaExtra } from "./seoul-live";

export type RoadLevel = "원활" | "서행" | "정체";
export type RoadSource = "seoul" | "its" | "ex";

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
  source: RoadSource;
}

export interface RoadStatus {
  local?: RoadGroup;
  highway?: RoadGroup;
  /** 자료 시각 (한국 시간 HH:mm, 가장 최근) */
  time?: string;
}

/** 구간 속도 → 단계. 고속도로는 기준이 더 높다 */
const LIMITS = { local: { jam: 15, slow: 30 }, highway: { jam: 40, slow: 70 } } as const;
/** 서울 실시간 지역 중심에서 이만큼 안이면 그 지역 도로 자료를 쓴다 */
const SEOUL_AREA_KM = 1.5;
/** 고속도로 콘존 끝 나들목이 장소에서 이만큼 안이면 넣는다 */
const HIGHWAY_KM = 8;

interface Link {
  roadName?: string;
  speed?: string | number;
  createdDate?: string;
}

// ── 국가교통정보센터 (지방 주변 도로)
const ITS_DOWN = "its:down";

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
  try {
    const res = await fetch(`https://openapi.its.go.kr:9443/trafficInfo?${qs}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`its ${res.status}`);
    const j = (await res.json()) as { header?: { resultCode?: number; resultMsg?: string }; body?: { items?: Link[] } };
    if (j.header?.resultCode !== undefined && j.header.resultCode !== 0) throw new Error(`its ${j.header.resultMsg}`);
    return { items: j.body?.items ?? [] };
  } catch (e) {
    // 접속이 막히면(연결 시간 초과) 페이지마다 10초씩 기다리지 않게 1시간 쉰다
    if ((e as { cause?: { code?: string } }).cause?.code === "UND_ERR_CONNECT_TIMEOUT") await kv.set(ITS_DOWN, "1", 3600).catch(() => {});
    throw e;
  }
}

/** 구간 목록 → 요약 (속도가 0이거나 말이 안 되는 값은 뺀다) */
export function summarize(items: Link[], kind: "local" | "highway", source: RoadSource = kind === "local" ? "its" : "ex"): RoadGroup | undefined {
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
  return { links: rows.length, avgSpeed, slowShare: Math.round(slowShare * 100) / 100, level, slowest, source };
}

/** "20261021091500" 등 → "09:15" */
const hhmm = (v?: string) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 12 ? `${d.slice(8, 10)}:${d.slice(10, 12)}` : undefined;
};

// ── 서울시 도시데이터 (서울 주변 도로)
/** 가장 가까운 서울 실시간 지역 (1.5km 안) */
export function nearestSeoulArea(p: LatLng): string | undefined {
  let best: { name: string; km: number } | undefined;
  for (const a of SEOUL_AREAS) {
    const km = distanceKm(p, a);
    if (km < SEOUL_AREA_KM && (!best || km < best.km)) best = { name: a.name, km };
  }
  return best?.name;
}

async function seoulLocal(p: LatLng): Promise<{ group?: RoadGroup; time?: string }> {
  const area = nearestSeoulArea(p);
  if (!area) return {};
  const road = (await getSeoulAreaExtra(area))?.road;
  if (!road || !["원활", "서행", "정체"].includes(road.index) || !road.links) return {};
  return {
    // 서울시가 정한 지역 단계(ROAD_TRAFFIC_IDX)를 그대로 쓴다 (도심 기준이라 우리 기준보다 정확)
    group: {
      links: road.links,
      avgSpeed: Math.round(road.speed),
      slowShare: road.slowShare ?? 0,
      level: road.index as RoadLevel,
      slowest: road.slowest ?? [],
      source: "seoul",
    },
    time: road.time?.slice(11, 16),
  };
}

// ── 한국도로공사 (고속도로)
export interface ExUnit {
  name: string;
  lat: number;
  lng: number;
}

export interface Conzone {
  /** 노선 이름 (예: 경부선) */
  route: string;
  /** 구간 이름 (예: 구서IC-영락IC) */
  name: string;
  speed: number;
}

/** 나들목·분기점 이름 비교용: 'IC', 'JC', '요금소', 괄호, 띄어쓰기를 뺀다 */
export const icKey = (s: string) =>
  s
    .replace(/\(.*?\)/g, "")
    .replace(/\s/g, "")
    .replace(/(IC|JC|TG|나들목|분기점|요금소|영업소|톨게이트|휴게소)$/i, "");

/** 순수 계산: 콘존 양 끝 나들목 중 좌표를 아는 곳이 장소에서 km 안인 콘존만 */
export function conzonesNear(units: ExUnit[], zones: Conzone[], p: LatLng, km = HIGHWAY_KM): Conzone[] {
  const at = new Map<string, ExUnit>();
  for (const u of units) at.set(icKey(u.name), u);
  return zones.filter((z) =>
    z.name
      .split("-")
      .map((end) => at.get(icKey(end)))
      .some((u) => u && distanceKm(p, u) < km),
  );
}

/** 순수 계산: 검지기(VDS) 줄 → 콘존별 평균 속도 (속도 0·빈 값은 뺀다) */
export function conzonesFrom(rows: { routeName?: string; conzoneId?: string; conzoneName?: string; speed?: string | number }[]): Conzone[] {
  const by = new Map<string, { route: string; name: string; sum: number; n: number }>();
  for (const r of rows) {
    const speed = Number(r.speed);
    if (!r.conzoneId || !r.conzoneName || !(speed > 0 && speed <= 200)) continue;
    const z = by.get(r.conzoneId) ?? { route: String(r.routeName ?? ""), name: r.conzoneName, sum: 0, n: 0 };
    z.sum += speed;
    z.n++;
    by.set(r.conzoneId, z);
  }
  return [...by.values()].map((z) => ({ route: z.route, name: z.name, speed: Math.round(z.sum / z.n) }));
}

const EX = "https://data.ex.co.kr/openapi";

async function exGet<T>(path: string, params: Record<string, string>): Promise<{ list: T[]; pageSize: number }> {
  await beforeCall(APIS.find((a) => a.id === "ex-traffic"));
  const qs = new URLSearchParams({ key: process.env.EX_API_KEY!, type: "json", ...params });
  const res = await fetch(`${EX}/${path}?${qs}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ex ${res.status}`);
  const j = (await res.json()) as { code?: string; message?: string; list?: T[]; pageSize?: number };
  if (j.code !== "SUCCESS") throw new Error(`ex ${j.message}`);
  return { list: j.list ?? [], pageSize: Number(j.pageSize) || 1 };
}

/** 영업소(나들목) 좌표 590곳 — 거의 안 바뀌어 하루 한 번 */
const exUnits = () =>
  cached(
    "ex:units",
    24 * 3600,
    async () => {
      const { list } = await exGet<{ unitName?: string; xValue?: string; yValue?: string }>("locationinfo/locationinfoUnit", {
        numOfRows: "1000",
        pageNo: "1",
      });
      return list
        .map((u) => ({ name: String(u.unitName ?? "").trim(), lat: Number(u.yValue), lng: Number(u.xValue) }))
        .filter((u) => u.name && u.lat > 33 && u.lat < 39 && u.lng > 124 && u.lng < 132);
    },
    (v) => v.length === 0,
  );

/** 전국 콘존 실시간 속도 (검지기 약 8,300줄 → 콘존별 평균). 10분마다, 모든 장소가 같이 쓴다 */
const exConzones = () =>
  cached(
    "ex:conzones",
    600,
    async () => {
      type Row = { routeName?: string; conzoneId?: string; conzoneName?: string; speed?: string; stdDate?: string; stdHour?: string };
      const first = await exGet<Row>("odtraffic/trafficAmountByRealtime", { numOfRows: "1000", pageNo: "1" });
      const rest = await Promise.all(
        Array.from({ length: Math.min(first.pageSize, 15) - 1 }, (_, i) =>
          exGet<Row>("odtraffic/trafficAmountByRealtime", { numOfRows: "1000", pageNo: String(i + 2) }).then((r) => r.list),
        ),
      );
      const rows = [...first.list, ...rest.flat()];
      const latest = rows
        .map((r) => `${r.stdDate ?? ""}${r.stdHour ?? ""}`)
        .sort()
        .at(-1);
      return { zones: conzonesFrom(rows), time: hhmm(latest) };
    },
    (v) => v.zones.length === 0,
  );

async function highwayNear(p: LatLng): Promise<{ group?: RoadGroup; time?: string }> {
  const [units, cz] = await Promise.all([exUnits(), exConzones()]);
  const near = conzonesNear(units, cz.zones, p);
  return {
    group: summarize(
      near.map((z) => ({ roadName: `${z.route} ${z.name}`, speed: z.speed })),
      "highway",
      "ex",
    ),
    time: cz.time,
  };
}

/** 장소 둘레 도로 소통. 자료가 모자라면 undefined */
export async function getRoadStatus(lat: number, lng: number): Promise<RoadStatus | undefined> {
  const p = { lat, lng };
  const fx = fixtureMode();
  const key = `road:v2:${fx ? `fx-${fx}:` : ""}${lat.toFixed(3)},${lng.toFixed(3)}`;
  try {
    if (fx) {
      // 고정 자료 모드: 예전처럼 its-traffic 고정 자료 하나로 두 묶음
      const [local, highway] = await Promise.all([fetchLinks("its", lat, lng, 0.018), fetchLinks("ex", lat, lng, 0.055)]);
      const out: RoadStatus = {
        local: summarize(local.items, "local"),
        highway: summarize(highway.items, "highway"),
        time: hhmm(
          [...local.items, ...highway.items]
            .map((i) => i.createdDate ?? "")
            .sort()
            .at(-1),
        ),
      };
      return out.local || out.highway ? out : undefined;
    }
    const localPart = async (): Promise<{ group?: RoadGroup; time?: string }> => {
      if (nearestSeoulArea(p)) return seoulLocal(p);
      if (!process.env.ITS_API_KEY || (await kv.get(ITS_DOWN).catch(() => null))) return {};
      const r = await cached(
        `${key}:its`,
        300,
        () => fetchLinks("its", lat, lng, 0.018),
        (v) => v.items.length === 0,
      );
      return {
        group: summarize(r.items, "local"),
        time: hhmm(
          r.items
            .map((i) => i.createdDate ?? "")
            .sort()
            .at(-1),
        ),
      };
    };
    const highwayPart = (): Promise<{ group?: RoadGroup; time?: string }> => (process.env.EX_API_KEY ? highwayNear(p) : Promise.resolve({}));
    const [local, highway] = await Promise.all([
      localPart().catch(() => ({}) as { group?: RoadGroup; time?: string }),
      highwayPart().catch(() => ({}) as { group?: RoadGroup; time?: string }),
    ]);
    const out: RoadStatus = { local: local.group, highway: highway.group, time: [local.time, highway.time].filter(Boolean).sort().at(-1) };
    return out.local || out.highway ? out : undefined;
  } catch {
    return undefined;
  }
}
