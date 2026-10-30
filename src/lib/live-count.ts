// 유료 '지금 실제 인원 보기' (경수님 10/28): 누르면 그때만 SK 장소 혼잡도를 불러온다.
// - 단계(plus·pro·max)마다 하루·월 횟수 (lib/business PLANS)
// - 같은 장소를 10분 안에 누가 이미 봤으면 SK를 다시 부르지 않고, 횟수도 줄이지 않는다 (공유 캐시)
// - SK 전체 하루 한도는 lib/skt (기본 + 회원 수 × 10)
import { kv } from "./cache";
import { planOf, type PlanId } from "./business";
import { getSktCongestion, type SktCongestion } from "./skt";
import { kst } from "./time";
import sktAreas from "@/data/skt-areas.json";
import sktPois from "@/data/skt-pois.json";

// SK 퍼즐이 실제 인원을 주는 장소 (10/30: 퍼즐은 정해진 3만여 곳만 — scripts/korea-data/skt-pois.mts 로 맞춤)
const SKT_POIS = sktPois as Record<string, { poiId: string; poiName: string }>;
export const hasLiveCount = (placeId: string) => placeId in SKT_POIS;

// 장소 넓이(㎡, OpenStreetMap 경계 — scripts/korea-data/skt-areas.mts). ㎡당 인원 × 넓이 = 약 몇 명 (경수님 10/30: 단계 말고 인원으로)
const AREAS = sktAreas as Record<string, { m2: number }>;

/** 보기 좋게 반올림: 100 미만은 그대로, 1천 미만은 10명, 그 위는 100명 단위 */
export function roundPeople(n: number): number {
  if (n < 100) return Math.round(n);
  if (n < 1000) return Math.round(n / 10) * 10;
  return Math.round(n / 100) * 100;
}

/** SK 결과에 '약 몇 명'을 붙인다. 넓이를 모르거나 SK가 ㎡당 값을 안 주면 그대로 (단계만) */
export function withPeople(placeId: string, data: SktCongestion): SktCongestion & { people?: number } {
  const m2 = AREAS[placeId]?.m2;
  return m2 && data.density !== undefined ? { ...data, people: roundPeople(data.density * m2) } : data;
}

const SHARE_SECONDS = 600;

export interface LiveCountResult {
  data?: SktCongestion & { people?: number };
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
  if (hit) return { data: withPeople(place.id, JSON.parse(String(hit)) as SktCongestion), shared: true, left: await liveLeft(uid, plan, unlimited) };

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
  return { data: withPeople(place.id, data), shared: false, left: unlimited ? UNLIMITED : { day: P.liveDaily - u.day - 1, month: P.liveMonthly - u.month - 1 } };
}
