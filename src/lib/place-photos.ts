// 장소 사진 (사용자 QA 10/22: 고해상도 대표·포토스팟 사진으로 상단 격자 재구성).
// src/data/korea/place-photos.json: 장소마다 6~8장, 첫 장이 대표. 위키미디어 커먼즈(CC0·CC BY·CC BY-SA·공유 저작물) + 한국관광공사(공공누리 제1유형)
// 커먼즈 사진은 저작자·라이선스·원본 페이지를 함께 보여 준다 (CC BY-SA 표시 조건)
import data from "@/data/korea/place-photos.json";
import type { Place } from "./types";

export interface PlacePhoto {
  src: string;
  w?: number;
  h?: number;
  credit: string;
  license: string;
  page?: string;
  alt?: string;
}

const PHOTOS = data as Record<string, PlacePhoto[]>;
/** 격자(큰 1 + 작은 4)를 채우려면 이만큼은 있어야 새 사진으로 바꾼다 */
const MIN = 3;

// 커먼즈 썸네일 주소의 추적용 쿼리(utm_*)는 떼어 낸다 (같은 사진이 다른 주소로 캐시되지 않게)
const clean = (src: string) => (src.includes("wikimedia.org") ? src.split("?")[0] : src);

/** 장소의 고해상도 사진 (모자라면 빈 배열 → 기존 사진을 쓴다) */
export function placePhotos(id: string): PlacePhoto[] {
  const list = PHOTOS[id] ?? [];
  return list.length >= MIN ? list.map((p) => ({ ...p, src: clean(p.src) })) : [];
}

/** 카드·목록에 쓰는 대표 사진: 새 사진의 첫 장, 없으면 기존 대표 사진 */
export function heroImage(place: Pick<Place, "id" | "image">): string | undefined {
  return placePhotos(place.id)[0]?.src ?? place.image;
}
