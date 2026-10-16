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
  };
}
