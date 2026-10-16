// 서울 여행 가이드 데이터 (scripts/seoul-data/sync.mjs 가 만든 src/data/seoul/*.json, 주 1회 갱신).
// 정적 데이터라 API 호출·Redis를 쓰지 않는다. 혼잡도는 가까운 서울시 실시간 지역(lib/seoul-live)에서 붙인다
import type { Lang } from "@/i18n/config";
import culture from "@/data/seoul/culture.json";
import guide from "@/data/seoul/guide.json";
import meta from "@/data/seoul/meta.json";
import reservations from "@/data/seoul/reservations.json";
import toilets from "@/data/seoul/toilets.json";
import { distanceKm, type LatLng } from "./geo";
import { SEOUL_AREAS, type SeoulArea } from "./seoul-areas";

export type GuideKind = "attraction" | "food" | "shopping" | "nature";
export const GUIDE_KINDS: { id: GuideKind; label: string; emoji: string }[] = [
  { id: "attraction", label: "명소", emoji: "🏛️" },
  { id: "food", label: "맛집", emoji: "🍽️" },
  { id: "shopping", label: "쇼핑", emoji: "🛍️" },
  { id: "nature", label: "자연", emoji: "🌳" },
];

export interface GuideText {
  n: string;
  a: string;
  h?: string;
  off?: string;
  tel?: string;
  sub?: string;
  menu?: string;
  tags?: string;
  url: string;
  web?: string;
}

export interface GuidePlace {
  id: string;
  kind: GuideKind;
  gu?: string;
  lat?: number;
  lng?: number;
  station?: string;
  t: Partial<Record<Lang, GuideText>>;
}

export const GUIDE = guide as GuidePlace[];
export const GUIDE_SYNCED_AT = (meta as { syncedAt: string }).syncedAt;

/** 그 언어 글이 없으면 영어 → 한국어 → 아무거나 */
export function guideText(p: GuidePlace, lang: Lang): { text: GuideText; lang: Lang } {
  for (const l of [lang, "en", "ko", ...(Object.keys(p.t) as Lang[])] as Lang[]) {
    const text = p.t[l];
    if (text) return { text, lang: l };
  }
  throw new Error(`no text: ${p.id}`);
}

export const getGuidePlace = (id: string) => GUIDE.find((p) => p.id === id);

/** 화장실: [이름, 위도, 경도, flags, 개방시간, 휴무, 구] — flags 1 24시간 · 2 장애인 · 4 기저귀 교환대 · 8 비상벨/CCTV · 16 민간 개방 */
export type Toilet = [string, number, number, number, string, string, string];
export const TOILETS = toilets as Toilet[];
export const TOILET_FLAG = { open24: 1, accessible: 2, diaper: 4, safety: 8, privateOpen: 16 } as const;

export interface CultureSpace {
  n: string;
  k: string;
  a: string;
  gu: string;
  lat: number;
  lng: number;
  tel?: string;
  web?: string;
  h?: string;
  off?: string;
  fee?: string;
  img?: string;
}
export const CULTURE = culture as CultureSpace[];

export interface Reservation {
  id: string;
  n: string;
  cat: string;
  place: string;
  gu: string;
  fee: string;
  who: string;
  url: string;
  img?: string;
  lat?: number;
  lng?: number;
  from: string;
  to: string;
  rcptEnd: string;
  status: string;
}
export const RESERVATIONS = reservations as Reservation[];

/** 가까운 순 (최대 n개, 반경 km 안) */
export function nearest<T>(items: T[], at: LatLng, pos: (x: T) => LatLng | undefined, n = 5, radiusKm = 1.5): { item: T; km: number }[] {
  const out: { item: T; km: number }[] = [];
  for (const item of items) {
    const p = pos(item);
    if (!p) continue;
    const km = distanceKm(at, p);
    if (km <= radiusKm) out.push({ item, km });
  }
  return out.sort((a, b) => a.km - b.km).slice(0, n);
}

/** 가장 가까운 서울시 실시간 지역 (1km 안) — 이 동네 지금 혼잡도 */
export function areaNear(at: LatLng, maxKm = 1): (SeoulArea & { km: number }) | undefined {
  let best: (SeoulArea & { km: number }) | undefined;
  for (const a of SEOUL_AREAS) {
    const km = distanceKm(at, a);
    if (km <= maxKm && (!best || km < best.km)) best = { ...a, km };
  }
  return best;
}
