// 장소 주소·사진 출처 글자 — 장소 자료(lib/places, 36KB)를 끌어오지 않는 가벼운 모듈.
// 브라우저에서 도는 컴포넌트(HomeList·PlaceRow·HeatMap·PlaceHero)는 이것만 쓴다 (사용자 10/26 성능: 링크 함수 하나 때문에 장소 전체가 번들에 들어갔다)
import { makeT, type T } from "../i18n/translate";
import photoCredits from "../data/korea/photo-credits.json";
import type { Place } from "./types";

const PHOTO_CREDITS = photoCredits as Record<string, { author: string; license: string; url: string }>;

/** 공항은 공항 탭 상세로, 나머지는 장소 상세로 */
export function placeHref(p: Pick<Place, "id" | "category">): string {
  return p.category === "airport" ? `/airport/${p.id}` : `/place/${p.id}`;
}

/** 사진 출처 한 줄 (예: 사진 한국관광공사, 사진 Kimhs5400 · CC BY 4.0) */
export function imageCreditText(p: Pick<Place, "imageCredit">, t: T = makeT(undefined)): string {
  return p.imageCredit ? t("사진 {author} · {license}", { author: p.imageCredit.author, license: p.imageCredit.license }) : t("사진 한국관광공사");
}

/**
 * 사진 여러 장 넘겨 보기의 장마다 출처: 관광공사 주소 → 한국관광공사, 우리가 받아 둔 위키미디어 사진 → 그 작성자·라이선스,
 * 그 밖(대표 사진) → 장소의 출처
 */
export function photoCreditText(src: string, p: Pick<Place, "imageCredit">, t: T = makeT(undefined)): string {
  if (src.startsWith("https://tong.visitkorea.or.kr/")) return t("사진 한국관광공사");
  const c = PHOTO_CREDITS[src];
  return c ? t("사진 {author} · {license}", { author: c.author, license: c.license }) : imageCreditText(p, t);
}
