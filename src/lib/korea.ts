// 지역별 대표 관광지(랜드마크)와 지역 묶음. 데이터: scripts/korea-data/landmarks.mjs → src/data/korea/landmarks.json
// (고른 목록 + 한국관광공사 사진·좌표, 주 1회 갱신). 혼잡도는 가까운 우리 장소·서울 실시간 지역에서 붙인다
import landmarks from "@/data/korea/landmarks.json";
import type { Lang } from "@/i18n/config";
import { distanceKm, type LatLng } from "./geo";
import { NEVER_FOR_OUTDOOR, OUTDOOR_AREA, sameName } from "./link-match";
import { PLACES, placeHref } from "./places";
import { SEOUL_AREAS, type SeoulArea } from "./seoul-areas";
import type { Category, Place } from "./types";

export type LandmarkKind = "history" | "nature" | "city" | "fun" | "sea";
export const LANDMARK_KINDS: { id: LandmarkKind; label: string; emoji: string }[] = [
  { id: "history", label: "역사·문화", emoji: "🏯" },
  { id: "nature", label: "자연", emoji: "🌿" },
  { id: "city", label: "도시·거리", emoji: "🏙️" },
  { id: "fun", label: "놀이·체험", emoji: "🎢" },
  { id: "sea", label: "바다", emoji: "🌊" },
];

export interface Landmark {
  id: string;
  /** 짧은 시도 이름 (예: 서울, 경북) */
  region: string;
  kind: LandmarkKind;
  n: Record<Lang, string>;
  lat: number;
  lng: number;
  /** 한국관광공사 대표 사진 */
  img: string;
  /** 한국관광공사 contentid */
  cid: string;
}

export const LANDMARKS = landmarks as Landmark[];

/** 지역 칩. 축제 지역(예: '전남광주 순천시')은 앞 낱말이 prefixes 중 하나면 그 지역 */
export const REGIONS: { id: string; prefixes: string[] }[] = [
  { id: "서울", prefixes: ["서울"] },
  { id: "부산", prefixes: ["부산"] },
  { id: "경기", prefixes: ["경기"] },
  { id: "인천", prefixes: ["인천"] },
  { id: "강원", prefixes: ["강원"] },
  { id: "제주", prefixes: ["제주"] },
  { id: "경북", prefixes: ["경북"] },
  { id: "경남", prefixes: ["경남"] },
  { id: "전북", prefixes: ["전북"] },
  { id: "전남", prefixes: ["전남", "전남광주"] },
  { id: "광주", prefixes: ["광주", "전남광주"] },
  { id: "충북", prefixes: ["충북"] },
  { id: "충남", prefixes: ["충남"] },
  { id: "대구", prefixes: ["대구"] },
  { id: "대전", prefixes: ["대전"] },
  { id: "울산", prefixes: ["울산"] },
  { id: "세종", prefixes: ["세종"] },
];

export const inRegion = (region: string, regionId: string) => !!REGIONS.find((r) => r.id === regionId)?.prefixes.includes(region.split(" ")[0]);

/** 명소 종류 → 이름이 '품음'(한쪽이 다른 쪽을 포함)일 때 이어도 되는 우리 장소 분류. 이름이 완전히 같으면 실내·공항·행사 말고는 분류를 따지지 않는다 */
const KIND_CATEGORIES: Record<LandmarkKind, readonly Category[]> = {
  history: ["landmark", "street"],
  nature: ["landmark", "street", "beach"],
  city: ["landmark", "street"],
  fun: ["themepark", "waterpark", "ski"],
  sea: ["beach"],
};
/** 이름이 같을 때 거리 한도(같은 이름의 다른 지점을 막는다) / 이름이 품을 때 거리 한도 */
const SAME_NAME_KM = 3;
const PART_NAME_KM = 1.5;

/**
 * 명소 ↔ 우리 장소가 같은 곳인지: 2 = 이름 같음(3km 안), 1 = 이름이 품고 분류가 맞고 1.5km 안, 0 = 다른 곳.
 * 실내(오락실·클라이밍·볼링 등)·공항·행사 장소는 바깥 명소와 이름으로 잇지 않는다 (11/1 QA: 광안리해수욕장 → 짱오락실 부산광안리점)
 */
export function landmarkPlaceMatch(l: Landmark, p: Place): 0 | 1 | 2 {
  if (NEVER_FOR_OUTDOOR.includes(p.category)) return 0;
  const km = distanceKm(p, l);
  const s = sameName(p.name, l.n.ko);
  if (s === 2 && km < SAME_NAME_KM) return 2;
  if (s === 1 && km < PART_NAME_KM && KIND_CATEGORIES[l.kind].includes(p.category)) return 1;
  return 0;
}

/** 명소 ↔ 서울 실시간 지역(이름을 '·'로 나눈 각 부분)이 같은 곳인지 (같음 3km 안 / 품음 1.5km 안) */
function landmarkAreaMatch(l: Landmark, a: SeoulArea): 0 | 1 | 2 {
  const km = distanceKm(a, l);
  const s = Math.max(0, ...a.name.split("·").map((n) => sameName(n, l.n.ko))) as 0 | 1 | 2;
  if (s === 2 && km < SAME_NAME_KM) return 2;
  if (s === 1 && km < PART_NAME_KM) return 1;
  return 0;
}

/** 점수가 가장 높은 것 (같으면 더 가까운 것) */
function best<T extends LatLng>(items: readonly T[], score: (x: T) => number, at: LatLng): T | undefined {
  let top: { item: T; s: number; km: number } | undefined;
  for (const item of items) {
    const s = score(item);
    if (!s) continue;
    const km = distanceKm(item, at);
    if (!top || s > top.s || (s === top.s && km < top.km)) top = { item, s, km };
  }
  return top?.item;
}

/**
 * 명소 → 우리 화면. 같은 곳인 실시간 장소(경복궁 → /place/gyeongbokgung) → 같은 이름의 서울 실시간 지역(창덕궁 → 창덕궁·종묘) → 명소 자체 화면(/spot).
 * 10/27 경수님 QA #10: 거리만으로 1.5km 안 장소에 붙이던 것(해운대해수욕장 → 씨라이프 아쿠아리움, 인사동 → 경복궁 등 14곳)을 이름이 맞을 때만으로.
 * 11/1: 이름이 '품음'만으로는 부족해서(광안리 ⊂ 짱오락실 부산광안리점) 분류·거리까지 맞을 때만 (landmarkPlaceMatch)
 */
export function landmarkLink(l: Landmark, lang: Lang): { href: string; external: boolean; placeId?: string; seoulCode?: string } {
  const place = best(PLACES, (p) => landmarkPlaceMatch(l, p), l);
  if (place) return { href: placeHref(place), external: false, placeId: place.id };
  const area = l.region === "서울" ? best(SEOUL_AREAS, (a) => landmarkAreaMatch(l, a), l) : undefined;
  if (area) return { href: `/seoul/${area.code}`, external: false, seoulCode: area.code };
  return { href: `/spot/${l.id}`, external: false };
}

/** 이름이 다른 명소가 거리로 혼잡을 빌려 쓸 수 있는 거리: 서울 실시간 지역(동네 인구) / 같은 종류의 우리 장소 */
export const BORROW_AREA_KM = 0.8;
export const BORROW_PLACE_KM = 1;

/**
 * 명소 상세·지도의 '지금 혼잡도'를 어디서 가져올지 (가까운 측정 지점).
 * 1) 같은 곳(landmarkLink와 같은 규칙) 2) 0.8km 안 서울 실시간 지역 3) 1km 안 같은 종류의 우리 장소(명소 ↔ 명소·거리, 바다 ↔ 해변, 놀이 ↔ 테마파크).
 * 실내·공항·행사 장소와, 종류가 다른 테마파크·워터파크·스키장은 빌리지 않는다 (11/1 QA: 해동용궁사 → 롯데월드 어드벤처 부산). 없으면 undefined (모델 추정).
 * has: 지금 값이 있는 곳만 고르게 (값이 없는 곳은 건너뛰고 다음 후보)
 */
export function landmarkCrowdSource(
  l: Landmark,
  has: { place?: (id: string) => boolean; area?: (code: string) => boolean } = {},
): { placeId: string; seoulCode?: undefined } | { seoulCode: string; placeId?: undefined } | undefined {
  const okPlace = (p: Place) => !has.place || has.place(p.id);
  const okArea = (a: SeoulArea) => !has.area || has.area(a.code);
  const same = best(PLACES, (p) => (okPlace(p) ? landmarkPlaceMatch(l, p) : 0), l);
  if (same) return { placeId: same.id };
  const seoul = l.region === "서울";
  const sameArea = seoul ? best(SEOUL_AREAS, (a) => (okArea(a) ? landmarkAreaMatch(l, a) : 0), l) : undefined;
  if (sameArea) return { seoulCode: sameArea.code };
  const area = seoul ? best(SEOUL_AREAS, (a) => (okArea(a) && distanceKm(a, l) < BORROW_AREA_KM ? 1 : 0), l) : undefined;
  if (area) return { seoulCode: area.code };
  const place = best(PLACES, (p) => (okPlace(p) && KIND_CATEGORIES[l.kind].includes(p.category) && distanceKm(p, l) < BORROW_PLACE_KM ? 1 : 0), l);
  if (place) return { placeId: place.id };
  return undefined;
}

/**
 * 진행 중인 축제(바깥 행사)의 지금 혼잡을 빌려 올 곳.
 * 1) 축제 이름에 우리 장소 이름이 그대로 들어 있고 1.5km 안 (에버랜드 튤립축제 → 에버랜드, 부산불꽃축제 → 부산불꽃축제). 실내·공항은 제외
 * 2) 0.8km 안 서울 실시간 지역 3) 1km 안 바깥 장소(명소·거리·해변). 실내·테마파크 등 다른 곳 값은 빌리지 않는다
 */
export function festivalCrowdSource(
  f: LatLng & { title: string; region: string },
  has: { place?: (id: string) => boolean; area?: (code: string) => boolean } = {},
): { placeId: string; seoulCode?: undefined } | { seoulCode: string; placeId?: undefined } | undefined {
  const okPlace = (p: Place) => !has.place || has.place(p.id);
  const title = f.title.replace(/\s/g, "");
  const named = best(
    PLACES,
    (p) => {
      if (!okPlace(p) || p.category === "indoor" || p.category === "airport" || distanceKm(p, f) >= PART_NAME_KM) return 0;
      const key = p.name.replace(/\s/g, "");
      return key.length >= 3 && title.includes(key) ? key.length : 0;
    },
    f,
  );
  if (named) return { placeId: named.id };
  const area = f.region.startsWith("서울")
    ? best(SEOUL_AREAS, (a) => ((!has.area || has.area(a.code)) && distanceKm(a, f) < BORROW_AREA_KM ? 1 : 0), f)
    : undefined;
  if (area) return { seoulCode: area.code };
  const place = best(PLACES, (p) => (okPlace(p) && OUTDOOR_AREA.includes(p.category) && distanceKm(p, f) < BORROW_PLACE_KM ? 1 : 0), f);
  if (place) return { placeId: place.id };
  return undefined;
}

/** 지도 앱 링크: 한국어면 카카오맵, 외국어면 구글 지도 */
export function landmarkMapHref(l: Landmark, lang: Lang): string {
  return lang === "ko"
    ? `https://map.kakao.com/link/map/${encodeURIComponent(l.n.ko)},${l.lat},${l.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;
}

/** 날짜마다 바뀌는 추천 순서 (같은 날에는 같은 순서라 캐시와 맞다) */
export function dailyPick<T>(items: T[], date: string, n: number): T[] {
  let seed = [...date].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}
