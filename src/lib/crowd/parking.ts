// 주차장 실시간 주차 현황 → 장소 보조 지표 (10/21 사용자 활용신청: 강원랜드 광장주차장 15168488, 하이원 스키장 약 1,700면).
// 스키장은 리프트 대기 API가 없어 '지금 주차된 차 수가 평소 이 요일·시간보다 얼마나 많은지'(lib/crowd/baseline)로 혼잡을 본다
// — 롯데월드가 잠실 지역 인구 × 평소 대비로 보는 것과 같은 방식.
// 공공데이터포털 명세(요청 주소·필드명)는 활용신청한 계정에서만 보인다 → 환경변수로 받는다:
//   PARKING_HIGH1_URL     전체 요청 주소 (serviceKey 제외. 예: https://apis.data.go.kr/B55xxxx/.../getParkingStatus?numOfRows=2000&type=json)
//   PARKING_HIGH1_FIELDS  "항목배열경로;상태필드;주차중값" (생략하면 응답에서 가장 큰 객체 배열과 '상태'가 든 필드를 찾아 쓴다)
//                          예: response.body.items;parkingStatus;1
// 실패·미설정이면 undefined → 모델만 쓴다 (화면에는 아무것도 안 보인다)
import { APIS, beforeCall } from "../api-quota";
import { cached } from "../cached";
import type { Place } from "../types";

export interface ParkingNow {
  /** 주차 중인 면 수 */
  occupied: number;
  /** 전체 면 수 */
  total: number;
  /** 받은 시각 ISO */
  at: string;
}

export interface ParkingLot {
  /** 환경변수 접미사 (PARKING_{ID}_URL) */
  id: string;
  label: string;
  /** 응답에 전체 면 수가 없을 때 쓰는 공식 면 수 */
  total: number;
}

/** 장소 → 주차장 (지금은 하이원만) */
export const PARKING_LOTS: Record<string, ParkingLot> = {
  high1: { id: "HIGH1", label: "강원랜드 광장주차장", total: 1700 },
};

const STATUS_KEY = /status|stts|state|상태|yn$/i;
const OCCUPIED = /^(1|y|yes|true|in|입차|주차중|occupied|full|사용)$/i;

/** 순수 계산: 응답 JSON에서 주차면 목록을 찾아 주차 중인 수를 센다. fields: "경로;상태필드;주차중값" */
export function parseParking(json: unknown, fields?: string, fallbackTotal?: number): { occupied: number; total: number } | undefined {
  const [path, statusField, occupiedValue] = (fields ?? "").split(";").map((s) => s.trim());
  let rows: unknown = json;
  if (path) for (const k of path.split(".")) rows = (rows as Record<string, unknown> | undefined)?.[k];
  else rows = largestArray(json);
  if (!Array.isArray(rows) || !rows.length) return undefined;
  const items = rows.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  if (!items.length) return undefined;
  const key = statusField || Object.keys(items[0]).find((k) => STATUS_KEY.test(k));
  if (!key) return undefined;
  const isOccupied = (v: unknown) => (occupiedValue ? String(v) === occupiedValue : OCCUPIED.test(String(v)));
  // 주차면 목록(면마다 한 줄)이면 전체 = 줄 수. 집계 응답(한 줄에 전체·주차 수)이면 숫자 필드로 본다
  if (items.length === 1) {
    const row = items[0];
    const num = (re: RegExp) => Object.entries(row).find(([k, v]) => re.test(k) && Number.isFinite(Number(v)));
    const total = num(/total|tot|전체|면수|capa/i);
    const used = num(/used|occupied|주차|cur|now|이용/i);
    if (total && used) return { occupied: Number(used[1]), total: Number(total[1]) };
  }
  const occupied = items.filter((r) => isOccupied(r[key])).length;
  return { occupied, total: fallbackTotal ?? items.length };
}

function largestArray(v: unknown, depth = 0): unknown[] | undefined {
  if (depth > 6 || !v || typeof v !== "object") return undefined;
  if (Array.isArray(v)) return v.length && typeof v[0] === "object" ? v : undefined;
  let best: unknown[] | undefined;
  for (const x of Object.values(v as Record<string, unknown>)) {
    const a = largestArray(x, depth + 1);
    if (a && (!best || a.length > best.length)) best = a;
  }
  return best;
}

/** 지금 주차 현황 (5분 캐시). 환경변수가 없거나 실패하면 undefined */
export async function getParkingNow(place: Place): Promise<ParkingNow | undefined> {
  const lot = PARKING_LOTS[place.id];
  const url = lot && process.env[`PARKING_${lot.id}_URL`];
  const key = process.env.DATA_GO_KR_KEY;
  if (!lot || !url || !key) return undefined;
  try {
    return await cached(`parking:${place.id}`, 300, async () => {
      await beforeCall(APIS.find((a) => a.id === "parking-high1"));
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}serviceKey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`parking ${lot.id} ${res.status}`);
      const parsed = parseParking(await res.json(), process.env[`PARKING_${lot.id}_FIELDS`], lot.total);
      if (!parsed) throw new Error(`parking ${lot.id}: 응답에서 주차면 목록을 찾지 못함`);
      return { ...parsed, at: new Date().toISOString() };
    });
  } catch (e) {
    console.warn("[parking]", e instanceof Error ? e.message : e);
    return undefined;
  }
}
