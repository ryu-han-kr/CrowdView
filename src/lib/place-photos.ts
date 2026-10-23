// 장소 사진 (사용자 QA 10/22: 고해상도 대표·포토스팟 사진으로 상단 격자 재구성).
// src/data/korea/place-photos.json: 장소마다 6~8장, 첫 장이 대표. 위키미디어 커먼즈(CC0·CC BY·CC BY-SA·공유 저작물) + 한국관광공사(공공누리 제1유형)
// 커먼즈 사진은 저작자·라이선스·원본 페이지를 함께 보여 준다 (CC BY-SA 표시 조건)
import data from "@/data/korea/place-photos.json";
import pro from "@/data/korea/pro-photos.json";
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

// 관광공사 관광사진 갤러리(전문 사진가 촬영, 공공누리 제1유형) — 있으면 맨 앞에 (사용자 10/22: 각 잡고 찍은 사진 위주로).
// scripts/korea-data/pro-photos.mts 가 채운다
const PRO = pro as Record<string, { src: string; w?: number; h?: number; title: string; photographer: string; month: string }[]>;
const proPhotos = (id: string): PlacePhoto[] =>
  (PRO[id] ?? []).map((p) => ({ src: p.src, w: p.w, h: p.h, credit: `한국관광공사 · ${p.photographer}`, license: "공공누리 제1유형", alt: p.title }));

// 갤러리 사진이 기존 대표보다 못한 곳 (10/23 전후 비교: 2013년 공항 사진, 슬로프 근접샷 등) → 기존 대표를 첫 장으로 두고 갤러리 사진은 그 뒤에
const KEEP_HERO = new Set(["korean-folk-village", "gimpo", "gimhae", "gyeongjuworld", "konjiam", "welli-hilli", "oakvalley", "alpensia"]);

/** 장소의 고해상도 사진 (모자라면 빈 배열 → 기존 사진을 쓴다). 관광공사 전문 사진이 있으면 앞에, 겹치는 주소는 한 번 */
export function placePhotos(id: string): PlacePhoto[] {
  const own = (PHOTOS[id] ?? []).map((p) => ({ ...p, src: clean(p.src) }));
  const ordered = KEEP_HERO.has(id) && own.length ? [own[0], ...proPhotos(id), ...own.slice(1)] : [...proPhotos(id), ...own];
  const list = ordered.filter(
    (p, i, arr) => arr.findIndex((x) => x.src === p.src) === i,
  );
  return list.length >= MIN ? list.slice(0, 12) : [];
}

/** 카드·목록에 쓰는 대표 사진: 새 사진의 첫 장, 없으면 기존 대표 사진 */
export function heroImage(place: Pick<Place, "id" | "image">): string | undefined {
  return placePhotos(place.id)[0]?.src ?? place.image;
}
