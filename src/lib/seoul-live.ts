// 서울 축제·행사 장소를 서울시 실시간 도시데이터 지역에 연결해 실시간 인구를 받는다.
import { APIS, beforeCall } from "./api-quota";
import { kv } from "./cache";
import { cached } from "./cached";
import { fixtureMode, loadFixture } from "./fixtures";
import { SEOUL_AREAS, type SeoulArea } from "./seoul-areas";

// 서울시 4단계 → 0~100 점수 (5단계 기준 각 구간의 중앙 부근)
export const SEOUL_LEVEL_SCORE: Record<string, number> = {
  여유: 25,
  보통: 48,
  "약간 붐빔": 68,
  붐빔: 88,
};

/** 축제 장소에서 이 거리 안에 실시간 지역 중심이 있으면 연결한다 */
const MAX_DISTANCE_M = 800;

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestSeoulArea(lat: number, lng: number): (SeoulArea & { distance: number }) | undefined {
  let best: (SeoulArea & { distance: number }) | undefined;
  for (const a of SEOUL_AREAS) {
    const d = distanceM(lat, lng, a.lat, a.lng);
    if (d <= MAX_DISTANCE_M && (!best || d < best.distance)) best = { ...a, distance: Math.round(d) };
  }
  return best;
}

export interface SeoulLive {
  area: string;
  distance: number;
  level: string;
  score: number;
  min: number;
  max: number;
  /** 서울시 기준 시각 (YYYY-MM-DD HH:mm) */
  time: string;
  forecast: {
    time: string;
    level: string;
    score: number;
    min: number;
    max: number;
  }[];
  /** 서울시 안내 문구 (예: "사람들이 몰려있을 가능성이 크고 …") */
  message?: string;
  /** 성별·연령대(%)·상주/비상주 비율 */
  profile?: { male: number; female: number; ages: number[]; resident: number };
}

/** 서울시 실시간 지역 묶음 (서울시 분류를 이름으로 나눈다) */
export type SeoulGroup = "tour" | "heritage" | "station" | "street" | "park";
export const SEOUL_GROUPS: { id: SeoulGroup; label: string; emoji: string }[] = [
  { id: "tour", label: "관광특구", emoji: "🗺️" },
  { id: "heritage", label: "고궁·문화유산", emoji: "🏯" },
  { id: "street", label: "발달상권", emoji: "🛍️" },
  { id: "park", label: "공원·한강", emoji: "🌳" },
  { id: "station", label: "역·인구밀집", emoji: "🚇" },
];
export function seoulGroup(name: string): SeoulGroup {
  if (name.includes("관광특구")) return "tour";
  if (/경복궁|덕수궁|창덕궁|종묘|보신각|유적|국립중앙박물관|숭례문/.test(name)) return "heritage";
  if (/공원|한강|숲|산$|노들섬|광장$|안양천|운동장|고척돔|폭포/.test(name)) return "park";
  if (/역(\(|$|·)|역\s|입구\(|사거리역|네거리역/.test(name) || name.endsWith("역")) return "station";
  return "street";
}

/**
 * 서울시 실시간 지역 전체 (약 120곳). 10분 수집기에 넣지 않고 누가 볼 때만 부른다.
 * 전체를 Redis 키 하나에 10분 저장 (페이지를 그릴 때 Redis 읽기 1번). 서울시에는 동시에 8개씩
 */
export function getAllSeoulLive(): Promise<Record<string, Omit<SeoulLive, "distance">>> {
  const key = process.env.SEOUL_OPENAPI_KEY ?? (fixtureMode() && "fixture");
  if (!key) return Promise.resolve({});
  return cached(
    `seoul:live:all${fixtureMode() ? `:fx-${fixtureMode()}` : ""}`,
    600,
    async () => {
      const out: Record<string, Omit<SeoulLive, "distance">> = {};
      const run = async (areas: SeoulArea[]) => {
        const queue = [...areas];
        await Promise.all(
          Array.from({ length: 8 }, async () => {
            for (let a = queue.shift(); a; a = queue.shift()) {
              const live = await fetchSeoulLive(key, a.name).catch(() => undefined);
              if (live) out[a.code] = live;
            }
          }),
        );
      };
      await run(SEOUL_AREAS);
      // 서울시가 몇 곳만 가끔 오류·시간 초과를 낸다 → 그곳만 한 번 더, 그래도 없으면 직전 값을 쓴다 (목록에서 빠지지 않게).
      // 직전 값도 서울시 기준 시각이 90분 안일 때만 (계속 이어 붙여 오래된 값이 남지 않게)
      const missing = () => SEOUL_AREAS.filter((a) => !out[a.code]);
      if (missing().length && missing().length < SEOUL_AREAS.length / 2) await run(missing());
      if (missing().length) {
        const prev = await kv
          .get("seoul:live:all")
          .then((raw) => (raw ? (JSON.parse(raw) as { v: typeof out }).v : null))
          .catch(() => null);
        // 서울시 시각은 KST "YYYY-MM-DD HH:mm"
        const recent = (time: string) => Date.now() - Date.parse(`${time.replace(" ", "T")}:00+09:00`) < SEOUL_STALE_MIN * 60_000;
        for (const a of missing()) if (prev?.[a.code] && recent(prev[a.code].time)) out[a.code] = prev[a.code];
      }
      return out;
    },
    (v) => Object.keys(v).length === 0,
  ).catch(() => ({}));
}

/** 지역 코드(POI001 등)로 실시간 인구 */
export async function getSeoulAreaLive(code: string): Promise<Omit<SeoulLive, "distance"> | undefined> {
  return (await getAllSeoulLive())[code];
}

/** 실시간 지역 인구 (5분 단위로 바뀌어 10분 캐시) */
export async function getSeoulLive(lat: number, lng: number): Promise<SeoulLive | undefined> {
  const key = process.env.SEOUL_OPENAPI_KEY ?? (fixtureMode() && "fixture");
  const area = nearestSeoulArea(lat, lng);
  if (!key || !area) return undefined;
  try {
    // 지역마다 10분에 한 번만 서울시를 부른다 (Redis 공유 캐시)
    const live = await cached(`seoul:live:${area.name}`, 600, () => fetchSeoulLive(key, area.name));
    return { ...live, distance: area.distance };
  } catch {
    return undefined;
  }
}

/** 서울시 기준 시각이 이보다 오래되면 '실시간'으로 쓰지 않는다 (서울시는 보통 5~20분 늦게 낸다) */
export const SEOUL_STALE_MIN = 90;

/** 고정 자료: 지역 이름별 행, 없으면 "*" 행을 그 지역 이름으로 (단계는 이름에 따라 고르게 섞는다) */
function fixtureRow(areaName: string): Record<string, unknown> | undefined {
  const fx = loadFixture<{
    rows?: Record<string, Record<string, unknown>>;
    "*"?: Record<string, unknown>;
  }>("seoul-citydata");
  if (!fx) return undefined;
  if (fx.rows?.[areaName]) return fx.rows[areaName];
  const base = fx["*"];
  if (!base) return undefined;
  const levels = Object.keys(SEOUL_LEVEL_SCORE);
  const h = [...areaName].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const level = typeof base.AREA_CONGEST_LVL === "string" && base.AREA_CONGEST_LVL !== "@mix" ? base.AREA_CONGEST_LVL : levels[h % levels.length];
  const min = (h % 40) * 500;
  return {
    ...base,
    AREA_NM: areaName,
    AREA_CONGEST_LVL: level,
    AREA_PPLTN_MIN: base.AREA_PPLTN_MIN ?? min,
    AREA_PPLTN_MAX: base.AREA_PPLTN_MAX ?? min + 2000,
  };
}

async function fetchSeoulLive(key: string, areaName: string): Promise<Omit<SeoulLive, "distance">> {
  if (fixtureMode()) {
    const row = fixtureRow(areaName);
    if (!row) throw new Error(`seoul citydata fixture: ${areaName} 없음`);
    return parseSeoulRow(row, areaName);
  }
  await beforeCall(APIS.find((a) => a.id === "seoul-citydata"));
  const res = await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/citydata_ppltn/1/5/${encodeURIComponent(areaName)}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`seoul citydata ${res.status}`);
  return parseSeoulRow((await res.json())["SeoulRtd.citydata_ppltn"]?.[0], areaName);
}

/**
 * 서울시 응답 한 줄 → 실시간 인구. 받는 데 성공해도 내용이 이상하면 쓰지 않는다 (QA 10/21 DATA-S02·SEOUL-S02):
 * 모르는 단계, 인구가 숫자가 아니거나 음수, 최소 > 최대, 시각이 없거나 미래(10분 넘게), 90분(SEOUL_STALE_MIN)보다 오래된 값
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSeoulRow(row: any, areaName: string, now = Date.now()): Omit<SeoulLive, "distance"> {
  if (!row || SEOUL_LEVEL_SCORE[row.AREA_CONGEST_LVL] === undefined) throw new Error("seoul citydata: unexpected payload");
  const min = Number(row.AREA_PPLTN_MIN);
  const max = Number(row.AREA_PPLTN_MAX);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || min > max)
    throw new Error(`seoul citydata: 인구 범위 이상 ${row.AREA_PPLTN_MIN}~${row.AREA_PPLTN_MAX}`);
  const time = String(row.PPLTN_TIME ?? "");
  const at = Date.parse(`${time.replace(" ", "T")}:00+09:00`);
  if (!Number.isFinite(at)) throw new Error(`seoul citydata: 시각 없음 '${time}'`);
  if (at - now > 10 * 60_000) throw new Error(`seoul citydata: 미래 시각 ${time}`);
  if (now - at > SEOUL_STALE_MIN * 60_000) throw new Error(`seoul citydata: 오래된 자료 ${time}`);
  return {
    area: areaName,
    level: row.AREA_CONGEST_LVL,
    score: SEOUL_LEVEL_SCORE[row.AREA_CONGEST_LVL],
    min,
    max,
    time,
    forecast: ((row.FCST_PPLTN ?? []) as Record<string, string>[])
      .filter(
        (f) =>
          SEOUL_LEVEL_SCORE[f.FCST_CONGEST_LVL] !== undefined &&
          Number(f.FCST_PPLTN_MIN) >= 0 &&
          Number(f.FCST_PPLTN_MIN) <= Number(f.FCST_PPLTN_MAX),
      )
      .map((f) => ({
        time: f.FCST_TIME,
        level: f.FCST_CONGEST_LVL,
        score: SEOUL_LEVEL_SCORE[f.FCST_CONGEST_LVL] ?? 0,
        min: Number(f.FCST_PPLTN_MIN),
        max: Number(f.FCST_PPLTN_MAX),
      })),
    message: row.AREA_CONGEST_MSG || undefined,
    profile:
      row.MALE_PPLTN_RATE !== undefined
        ? {
            male: Number(row.MALE_PPLTN_RATE),
            female: Number(row.FEMALE_PPLTN_RATE),
            ages: [0, 10, 20, 30, 40, 50, 60, 70].map((a) => Number(row[`PPLTN_RATE_${a}`] ?? 0)),
            resident: Number(row.RESNT_PPLTN_RATE ?? 0),
          }
        : undefined,
  };
}

/** 지역 상세용 추가 정보 (실시간 도시데이터 전체판에서 필요한 것만) */
export interface SeoulAreaExtra {
  /** 상권 전체 결제 붐빔 단계 (한산한 / 보통 / 분주한 / 바쁜) */
  commerce?: {
    level: string;
    time: string;
    categories: { name: string; group: string; level: string }[];
  };
  road?: {
    index: string;
    speed: number;
    message: string;
    /** "2026-10-21 14:15" */
    time?: string;
    /** 속도 자료가 있는 구간 수 */
    links?: number;
    /** 서행·정체 구간 비율 (0~1) */
    slowShare?: number;
    /** 서행·정체인 도로 중 가장 느린 3곳 (도로별 가장 느린 구간) */
    slowest?: { road: string; speed: number }[];
  };
  bikes?: number;
}

/**
 * 실시간 도시데이터 전체판 (지역 하나에 약 200KB). 지역 상세를 열 때만, 지역마다 10분에 한 번 부르고
 * 화면에 쓰는 몇 가지만 뽑아 Redis에 저장한다
 */
export async function getSeoulAreaExtra(areaName: string): Promise<SeoulAreaExtra | undefined> {
  const key = process.env.SEOUL_OPENAPI_KEY; // 고정 자료 모드에는 상권·도로 자료가 없어 부르지 않는다
  if (!key) return undefined;
  try {
    return await cached(`seoul:extra:${areaName}`, 600, async () => {
      await beforeCall(APIS.find((a) => a.id === "seoul-citydata"));
      const res = await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/citydata/1/5/${encodeURIComponent(areaName)}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`seoul citydata ${res.status}`);
      const c = (await res.json()).CITYDATA ?? {};
      const cm = c.LIVE_CMRCL_STTS;
      const road = c.ROAD_TRAFFIC_STTS?.AVG_ROAD_DATA;
      const links = ((c.ROAD_TRAFFIC_STTS?.ROAD_TRAFFIC_STTS ?? []) as { ROAD_NM?: string; SPD?: number | string; IDX?: string }[])
        .map((l) => ({ road: String(l.ROAD_NM ?? "").trim(), speed: Number(l.SPD), idx: String(l.IDX ?? "") }))
        .filter((l) => l.speed > 0 && l.speed <= 200);
      const slowByRoad = new Map<string, number>();
      for (const l of links) if (l.road && l.idx !== "원활") slowByRoad.set(l.road, Math.min(slowByRoad.get(l.road) ?? Infinity, l.speed));
      const bikes = ((c.SBIKE_STTS ?? []) as Record<string, string>[]).reduce((s, b) => s + (Number(b.SBIKE_PARKING_CNT) || 0), 0);
      return {
        commerce: cm?.AREA_CMRCL_LVL
          ? {
              level: String(cm.AREA_CMRCL_LVL),
              time: String(cm.CMRCL_TIME ?? ""),
              categories: ((cm.CMRCL_RSB ?? []) as Record<string, string>[]).map((r) => ({
                name: r.RSB_MID_CTGR,
                group: r.RSB_LRG_CTGR,
                level: r.RSB_PAYMENT_LVL,
              })),
            }
          : undefined,
        road: road?.ROAD_TRAFFIC_IDX
          ? {
              index: road.ROAD_TRAFFIC_IDX,
              speed: Number(road.ROAD_TRAFFIC_SPD),
              message: road.ROAD_MSG,
              time: road.ROAD_TRAFFIC_TIME ? String(road.ROAD_TRAFFIC_TIME) : undefined,
              links: links.length,
              slowShare: links.length ? Math.round((links.filter((l) => l.idx !== "원활").length / links.length) * 100) / 100 : undefined,
              slowest: [...slowByRoad]
                .sort((a, b) => a[1] - b[1])
                .slice(0, 3)
                .map(([r, speed]) => ({ road: r, speed: Math.round(speed) })),
            }
          : undefined,
        bikes: bikes || undefined,
      };
    });
  } catch {
    return undefined;
  }
}
