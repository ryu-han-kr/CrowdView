// SK open API (openapi.sk.com) 장소 혼잡도: 서울 밖 관광지·축제의 실시간 혼잡도.
// 서울시 데이터가 없는 곳을 채운다. SK_OPENAPI_APP_KEY가 없으면 아무것도 하지 않는다.
//
// 1) TMAP 장소 검색으로 장소 ID(poiId)를 찾고 (30일 캐시)
// 2) Puzzle 실시간 장소 혼잡도로 지금 혼잡도를 받는다 (10분 캐시)
// 응답 형식은 SK 문서 기준으로 맞췄지만 키를 받은 뒤 실제 응답으로 다시 확인해야 한다 (필드가 없으면 undefined)
import { APIS, beforeCall } from "./api-quota";
import { cached } from "./cached";
import { activePlusCount } from "./plus";

const BASE = "https://apis.openapi.sk.com";
const appKey = () => process.env.SK_OPENAPI_APP_KEY;

export interface SktCongestion {
  poiName: string;
  /** SK 혼잡도 단계 (1 여유 ~ 4 붐빔으로 정규화) */
  level: 1 | 2 | 3 | 4;
  /** 0~100 점수 (서울시 단계 점수와 같은 눈금) */
  score: number;
  /** YYYY-MM-DD HH:mm */
  time: string;
}

// 서울시 4단계 점수와 맞춘다 (lib/seoul-live.ts SEOUL_LEVEL_SCORE)
const LEVEL_SCORE = { 1: 25, 2: 48, 3: 68, 4: 88 } as const;

async function call(path: string, params: Record<string, string> = {}): Promise<unknown> {
  // 하루 한도 = 기본(SK_DAILY_LIMIT, 30) + Plus 회원 수 × 회원당(SK_PER_MEMBER, 10) (경수님 10/28: 회원이 늘면 조금씩 같이 늘게).
  // 회원 수는 10분 캐시. DB가 안 되면 기본 한도만
  const api = APIS.find((a) => a.id === "skt-congestion");
  const members = await cached("plus:active-count", 600, activePlusCount).catch(() => 0);
  await beforeCall(api && { ...api, limit: (api.limit ?? 30) + members * (Number(process.env.SK_PER_MEMBER) || 10) });
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
    headers: { appKey: appKey()!, accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`skt ${path} ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

/** 이름 + 좌표로 TMAP 장소 ID (반경 2km 안 첫 결과) */
function poiIdOf(name: string, lat: number, lng: number): Promise<string | null> {
  return cached(`skt:poi:${name}`, 30 * 24 * 3600, async () => {
    const json = (await call("/tmap/pois", {
      version: "1",
      searchKeyword: name,
      centerLat: String(lat),
      centerLon: String(lng),
      radius: "2",
      count: "1",
      searchtypCd: "R",
    })) as { searchPoiInfo?: { pois?: { poi?: { id?: string }[] } } };
    return json.searchPoiInfo?.pois?.poi?.[0]?.id ?? null;
  });
}

function normalizeLevel(v: unknown): 1 | 2 | 3 | 4 | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // 1~4단계면 그대로, 1~10단계면 4단계로 묶는다
  if (n <= 4) return n as 1 | 2 | 3 | 4;
  return n <= 3 ? 1 : n <= 5 ? 2 : n <= 7 ? 3 : 4;
}

/** 장소 이름·좌표로 실시간 혼잡도. 키가 없거나 데이터가 없으면 undefined */
export async function getSktCongestion(name: string, lat: number, lng: number): Promise<SktCongestion | undefined> {
  if (!appKey()) return undefined;
  try {
    const poiId = await poiIdOf(name, lat, lng);
    if (!poiId) return undefined;
    return await cached(`skt:rltm:${poiId}`, 600, async () => {
      const json = (await call(`/puzzle/place/congestion/rltm/pois/${poiId}`)) as {
        contents?: { poiName?: string; rltm?: Record<string, unknown> | Record<string, unknown>[] };
      };
      const rltm = json.contents?.rltm;
      const row = Array.isArray(rltm) ? rltm[0] : rltm;
      const level = normalizeLevel(row?.congestionLevel);
      if (!row || !level) throw new Error("skt rltm: no congestion");
      const dt = String(row.datetime ?? "");
      return {
        poiName: String(json.contents?.poiName ?? name),
        level,
        score: LEVEL_SCORE[level],
        time: dt.length >= 12 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)} ${dt.slice(8, 10)}:${dt.slice(10, 12)}` : "",
      };
    });
  } catch (e) {
    console.warn(`[skt] ${name}:`, e instanceof Error ? e.message : e);
    return undefined;
  }
}
