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

export const inRegion = (region: string, regionId: string) =>
  !!REGIONS.find((r) => r.id === regionId)?.prefixes.includes(region.split(" ")[0]);

/**
 * 랜드마크를 누르면 갈 곳과 혼잡도 출처: 우리 장소(1.5km 안) → 서울 실시간 지역(0.8km 안) → 지도.
 * 지도는 한국어면 카카오맵, 외국어면 구글 지도
 */
export function landmarkLink(l: Landmark, lang: Lang): { href: string; external: boolean; placeId?: string; seoulCode?: string } {
  const place = PLACES.find((p) => p.category !== "airport" && distanceKm(p, l) < 1.5);
  if (place) return { href: placeHref(place), external: false, placeId: place.id };
  const area = l.region === "서울" ? SEOUL_AREAS.find((a) => distanceKm(a, l) < 0.8) : undefined;
  if (area) return { href: `/seoul/${area.code}`, external: false, seoulCode: area.code };
  return {
    href:
      lang === "ko"
        ? `https://map.kakao.com/link/map/${encodeURIComponent(l.n.ko)},${l.lat},${l.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`,
    external: true,
  };
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
