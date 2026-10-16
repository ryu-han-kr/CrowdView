// 서울 축제·행사 장소를 서울시 실시간 도시데이터 지역에 연결해 실시간 인구를 받는다.
import { APIS, beforeCall } from "./api-quota";
import { cached } from "./cached";
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
  forecast: { time: string; level: string; score: number; min: number; max: number }[];
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
  if (/공원|한강|숲|산$|노들섬|광장$|안양천|운동장|고척돔/.test(name)) return "park";
  if (/역(\(|$|·)|역\s|입구\(|사거리역|네거리역/.test(name) || name.endsWith("역")) return "station";
  return "street";
}

/**
 * 서울시 실시간 지역 전체 (약 120곳). 10분 수집기에 넣지 않고 누가 볼 때만 부른다.
 * 전체를 Redis 키 하나에 10분 저장 (페이지를 그릴 때 Redis 읽기 1번). 서울시에는 동시에 8개씩
 */
export function getAllSeoulLive(): Promise<Record<string, Omit<SeoulLive, "distance">>> {
  const key = process.env.SEOUL_OPENAPI_KEY;
  if (!key) return Promise.resolve({});
  return cached(
    "seoul:live:all",
    600,
    async () => {
      const out: Record<string, Omit<SeoulLive, "distance">> = {};
      const queue = [...SEOUL_AREAS];
      await Promise.all(
        Array.from({ length: 8 }, async () => {
          for (let a = queue.shift(); a; a = queue.shift()) {
            const live = await fetchSeoulLive(key, a.name).catch(() => undefined);
            if (live) out[a.code] = live;
          }
        }),
      );
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
  const key = process.env.SEOUL_OPENAPI_KEY;
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

async function fetchSeoulLive(key: string, areaName: string): Promise<Omit<SeoulLive, "distance">> {
  await beforeCall(APIS.find((a) => a.id === "seoul-citydata"));
  const res = await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/citydata_ppltn/1/5/${encodeURIComponent(areaName)}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`seoul citydata ${res.status}`);
  const row = (await res.json())["SeoulRtd.citydata_ppltn"]?.[0];
  if (!row || SEOUL_LEVEL_SCORE[row.AREA_CONGEST_LVL] === undefined) throw new Error("seoul citydata: unexpected payload");
  return {
    area: areaName,
    level: row.AREA_CONGEST_LVL,
    score: SEOUL_LEVEL_SCORE[row.AREA_CONGEST_LVL],
    min: Number(row.AREA_PPLTN_MIN),
    max: Number(row.AREA_PPLTN_MAX),
    time: String(row.PPLTN_TIME ?? ""),
    forecast: ((row.FCST_PPLTN ?? []) as Record<string, string>[]).map((f) => ({
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
