// 지역별 대표 관광지(랜드마크)와 지역 묶음. 데이터: scripts/korea-data/landmarks.mjs → src/data/korea/landmarks.json
// (고른 목록 + 한국관광공사 사진·좌표, 주 1회 갱신). 혼잡도는 가까운 우리 장소·서울 실시간 지역에서 붙인다
import landmarks from "@/data/korea/landmarks.json";
import type { Lang } from "@/i18n/config";
import { distanceKm } from "./geo";
import { PLACES, placeHref } from "./places";
import { SEOUL_AREAS } from "./seoul-areas";

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

/**
 * 랜드마크를 누르면 갈 곳과 혼잡도 출처: 우리 장소(1.5km 안) → 서울 실시간 지역(0.8km 안) → 명소 상세(/spot/{id})
 */
/** 이름 비교용: 띄어쓰기·괄호·기호와 '해수욕장·공원·역·타워·관광특구' 같은 일반 꼬리를 뗀다 */
const nameKey = (name: string) => name.replace(/\(.*?\)/g, "").replace(/[\s·()\-]/g, "").replace(/(서울)?(해수욕장|해변|공원|역|타워|관광특구|일대)$/g, "");
/** 두 이름이 같은 곳을 가리키는지: 2 = 같음, 1 = 한쪽이 다른 쪽을 품음(2글자 이상), 0 = 다름. 괄호 안 이름(DDP(동대문디자인플라자))도 본다 */
const sameName = (a: string, b: string): 0 | 1 | 2 => {
  const parts = (n: string) => [n, ...(n.match(/\((.*?)\)/g) ?? []).map((p) => p.slice(1, -1))].map(nameKey).filter((k) => k.length >= 2);
  let best: 0 | 1 | 2 = 0;
  for (const x of parts(a)) for (const y of parts(b)) best = Math.max(best, x === y ? 2 : x.includes(y) || y.includes(x) ? 1 : 0) as 0 | 1 | 2;
  return best;
};
/** 이름이 가장 잘 맞는 것 (같음 > 품음) */
function bestNamed<T>(items: T[], name: (x: T) => string[], target: string): T | undefined {
  let best: { item: T; score: 0 | 1 | 2 } | undefined;
  for (const item of items) {
    const score = Math.max(0, ...name(item).map((n) => sameName(n, target))) as 0 | 1 | 2;
    if (score && (!best || score > best.score)) best = { item, score };
  }
  return best?.item;
}

/**
 * 명소 → 우리 화면. 같은 이름의 실시간 장소(경복궁 → /place/gyeongbokgung) → 같은 이름의 서울 실시간 지역(창덕궁 → 창덕궁·종묘) → 명소 자체 화면(/spot).
 * 10/27 경수님 QA #10: 거리만으로 1.5km 안 장소에 붙이던 것(해운대해수욕장 → 씨라이프 아쿠아리움, 인사동 → 경복궁 등 14곳)을 이름이 맞을 때만으로
 */
export function landmarkLink(l: Landmark, lang: Lang): { href: string; external: boolean; placeId?: string; seoulCode?: string } {
  const place = bestNamed(PLACES.filter((p) => p.category !== "airport" && distanceKm(p, l) < 3), (p) => [p.name], l.n.ko);
  if (place) return { href: placeHref(place), external: false, placeId: place.id };
  const area = l.region === "서울" ? bestNamed(SEOUL_AREAS.filter((a) => distanceKm(a, l) < 3), (a) => a.name.split("·"), l.n.ko) : undefined;
  if (area) return { href: `/seoul/${area.code}`, external: false, seoulCode: area.code };
  return { href: `/spot/${l.id}`, external: false };
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
