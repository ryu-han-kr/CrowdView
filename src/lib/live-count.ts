// 유료 '지금 실제 인원 보기' (경수님 10/28): 누르면 그때만 SK 장소 혼잡도를 불러온다.
// - 단계(plus·pro·max)마다 하루·월 횟수 (lib/business PLANS)
// - 같은 장소를 10분 안에 누가 이미 봤으면 SK를 다시 부르지 않고, 횟수도 줄이지 않는다 (공유 캐시)
// - SK 전체 하루 한도는 lib/skt (기본 + 회원 수 × 10)
import { kv } from "./cache";
import { planOf, type PlanId } from "./business";
import { getSktCongestion, type SktCongestion } from "./skt";
import { kst } from "./time";
import sktPois from "@/data/skt-pois.json";

// SK 퍼즐이 실제 인원을 주는 장소 (10/30: 퍼즐은 정해진 3만여 곳만 — scripts/korea-data/skt-pois.mts 로 맞춤)
const SKT_POIS = sktPois as Record<string, { poiId: string; poiName: string }>;
export const hasLiveCount = (placeId: string) => placeId in SKT_POIS;

const SHARE_SECONDS = 600;

export interface LiveCountResult {
  data?: SktCongestion;
  /** 다른 회원이 10분 안에 본 결과라 횟수가 줄지 않았다 */
  shared: boolean;
  left: { day: number; month: number };
  error?: string;
}

const dayKey = (uid: string) => `live:d:${kst().date}:${uid}`;
const monthKey = (uid: string) => `live:m:${kst().date.slice(0, 7)}:${uid}`;

async function used(uid: string): Promise<{ day: number; month: number }> {
  const [d, m] = await Promise.all([kv.get(dayKey(uid)).catch(() => null), kv.get(monthKey(uid)).catch(() => null)]);
  return { day: Number(d ?? 0), month: Number(m ?? 0) };
}

/** 남은 횟수만 (화면에 미리 보여 줄 때) */
// 운영자(무제한)는 남은 횟수를 999로 보인다
const UNLIMITED = { day: 999, month: 999 };

export async function liveLeft(uid: string, plan: PlanId, unlimited = false): Promise<{ day: number; month: number }> {
  if (unlimited) return UNLIMITED;
  const P = planOf(plan);
  const u = await used(uid);
  return { day: Math.max(0, P.liveDaily - u.day), month: Math.max(0, P.liveMonthly - u.month) };
}

export async function liveCount(
  uid: string,
  plan: PlanId,
  place: { id: string; name: string; lat: number; lng: number },
  unlimited = false,
): Promise<LiveCountResult> {
  const P = unlimited ? { liveDaily: Infinity, liveMonthly: Infinity } : planOf(plan);
  const cacheKey = `live:place:${place.id}`;
  const hit = await kv.get(cacheKey).catch(() => null);
  if (hit) return { data: JSON.parse(String(hit)) as SktCongestion, shared: true, left: await liveLeft(uid, plan, unlimited) };

  const u = await used(uid);
  if (u.day >= P.liveDaily) return { shared: false, left: { day: 0, month: Math.max(0, P.liveMonthly - u.month) }, error: "오늘 횟수를 다 썼어요" };
  if (u.month >= P.liveMonthly) return { shared: false, left: { day: 0, month: 0 }, error: "이번 달 횟수를 다 썼어요" };

  // 퍼즐이 지원하지 않는 곳은 SK를 부르지 않는다 (불러도 NOT_FOUND_POI, 하루 한도만 줄어든다)
  const poi = SKT_POIS[place.id];
  if (!poi) return { shared: false, left: await liveLeft(uid, plan, unlimited), error: "이 장소는 아직 실제 인원 데이터가 없어요" };
  const data = await getSktCongestion(place.name, place.lat, place.lng, poi.poiId);
  if (!data) return { shared: false, left: await liveLeft(uid, plan, unlimited), error: "지금은 실제 인원을 불러올 수 없어요" };
  // 성공했을 때만 횟수를 줄인다
  await Promise.all([
    kv.incr(dayKey(uid), 2 * 86_400, 1).catch(() => 0),
    kv.incr(monthKey(uid), 40 * 86_400, 1).catch(() => 0),
    kv.set(cacheKey, JSON.stringify(data), SHARE_SECONDS).catch(() => {}),
  ]);
  return { data, shared: false, left: unlimited ? UNLIMITED : { day: P.liveDaily - u.day - 1, month: P.liveMonthly - u.month - 1 } };
}
