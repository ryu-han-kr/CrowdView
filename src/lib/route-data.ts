// 추천 루트 후보 장소: 우리 장소(오늘 시간대별 예측) + 서울시 실시간 지역(서울시 12시간 예측).
// 역 주변(인구밀집 지역)은 목적지가 아니라서 뺀다. 식사 장소는 서울 여행 가이드 맛집(정확한 좌표가 있는 곳)
import { getAllCrowd } from "./crowd/service";
import { distanceKm, travelMinutes, type LatLng, type Transport } from "./geo";
import { PLACES, placeHref } from "./places";
import type { Candidate, Interest, Leg, MealSpot } from "./route";
import { GUIDE } from "./seoul-guide";
import { SEOUL_AREAS } from "./seoul-areas";
import { getAllSeoulLive, seoulGroup, type SeoulGroup } from "./seoul-live";
import { subwayTrip } from "./subway";
import type { Category } from "./types";

const PLACE_INTEREST: Partial<Record<Category, Interest>> = { landmark: "history", street: "shopping", themepark: "fun", beach: "nature" };
const PLACE_OVERRIDE: Record<string, Interest> = { namsan: "nature" };
const PLACE_STAY: Partial<Record<Category, number>> = { landmark: 80, street: 70, themepark: 240, beach: 90 };

const GROUP_INTEREST: Partial<Record<SeoulGroup, Interest>> = { heritage: "history", park: "nature", street: "shopping", tour: "shopping" };
// 운영 시간 정보가 없는 곳의 기본 방문 가능 시간 (밤늦게 공원·고궁으로 보내지 않게)
const DEFAULT_HOURS: Record<Interest, [number, number]> = { history: [9, 18], nature: [6, 22], shopping: [10, 23], fun: [10, 22] };
const GROUP_STAY: Partial<Record<SeoulGroup, number>> = { heritage: 80, park: 60, street: 60, tour: 70 };

export async function getRouteCandidates(): Promise<Candidate[]> {
  const [crowd, seoul] = await Promise.all([getAllCrowd(), getAllSeoulLive()]);
  const out: Candidate[] = [];

  for (const p of PLACES) {
    const interest = PLACE_OVERRIDE[p.id] ?? PLACE_INTEREST[p.category];
    const c = crowd[p.id];
    if (!interest || !c) continue;
    out.push({
      id: p.id,
      name: p.name,
      href: placeHref(p),
      lat: p.lat,
      lng: p.lng,
      interest,
      stay: PLACE_STAY[p.category] ?? 60,
      hourly: Object.fromEntries(c.hourly.map((h) => [h.hour % 24, h.score])),
      now: c.score,
      hours: p.hours,
      basis: "place",
    });
  }

  for (const a of SEOUL_AREAS) {
    const group = seoulGroup(a.name);
    const interest = GROUP_INTEREST[group];
    const live = seoul[a.code];
    if (!interest || !live) continue;
    // 우리 장소와 같은 곳이면 장소 쪽을 쓴다 (예: 경복궁, 홍대)
    if (PLACES.some((p) => p.seoulArea === a.name || distanceKm(p, a) < 0.3)) continue;
    const hourly: Record<number, number> = { [Number(live.time.slice(11, 13))]: live.score };
    for (const f of live.forecast) hourly[Number(f.time.slice(11, 13))] = f.score;
    out.push({
      id: `seoul-${a.code}`,
      name: a.name,
      href: `/seoul/${a.code}`,
      lat: a.lat,
      lng: a.lng,
      interest,
      stay: GROUP_STAY[group] ?? 60,
      hourly,
      now: live.score,
      hours: DEFAULT_HOURS[interest],
      basis: "seoul",
    });
  }
  return out;
}

/** 출발지 고르기 목록 (위치를 못 쓸 때) */
export const START_HUBS: { id: string; name: string; lat: number; lng: number }[] = [
  "서울역",
  "명동 관광특구",
  "홍대 관광특구",
  "강남역",
  "잠실 관광특구",
  "여의도",
  "성수카페거리",
  "광화문·덕수궁",
  "이태원 관광특구",
  "건대입구역",
]
  .map((name) => SEOUL_AREAS.find((a) => a.name === name))
  .filter((a): a is (typeof SEOUL_AREAS)[number] => !!a)
  .map((a) => ({ id: a.code, name: a.name, lat: a.lat, lng: a.lng }));

/**
 * 구간 이동시간: 1.2km 안이면 걷기, 그보다 멀면 지하철 노선망(역까지 걷기 + 기다림 + 갈아타기)으로.
 * 근처에 역이 없으면 직선거리 어림(버스 포함)으로 돌아간다. 걷는 게 더 빠르면 걷기
 */
export function transitTravel(a: LatLng, b: LatLng, mode: Transport): Leg {
  const est = travelMinutes(a, b, mode);
  if (est.walk) return est;
  const trip = subwayTrip(a, b);
  if (!trip) return est;
  const walkMin = Math.round((est.km / 4.5) * 60);
  if (walkMin <= trip.minutes) return { minutes: walkMin, km: est.km, walk: true };
  return { minutes: trip.minutes, km: trip.km, walk: false, lines: trip.lines };
}

// 가이드 '음식점'에는 돌담길·경기장 같은 곳도 섞여 있어 대표 메뉴가 있는 곳만, 카페·제과·술집은 식사가 아니라 뺀다
const NOT_MEAL = /카페|cafe|커피|coffee|제과|베이커리|bakery|빙수|디저트|술집|와인|펍|pub|바$|shop|스토어/i;

/** 코스에 끼워 넣을 맛집 (이름은 한국어, 화면에서는 가이드의 그 언어 이름으로 바꾼다) */
export const MEAL_SPOTS: MealSpot[] = GUIDE.filter(
  (p) => p.kind === "food" && p.exact && p.lat && p.lng && p.t.ko?.menu && !NOT_MEAL.test(p.t.ko?.n ?? ""),
).map((p) => ({
  id: p.id,
  name: p.t.ko?.n ?? p.t.en?.n ?? p.id,
  href: `/guide/${p.id}`,
  lat: p.lat!,
  lng: p.lng!,
}));
