// 장소 사진 (사용자 QA 10/22: 고해상도 대표·포토스팟 사진으로 상단 격자 재구성).
// src/data/korea/place-photos.json: 장소마다 6~8장, 첫 장이 대표. 위키미디어 커먼즈(CC0·CC BY·CC BY-SA·공유 저작물) + 한국관광공사(공공누리 제1유형)
// 커먼즈 사진은 저작자·라이선스·원본 페이지를 함께 보여 준다 (CC BY-SA 표시 조건)
import data from "@/data/korea/place-photos.json";
import pro from "@/data/korea/pro-photos.json";
import picks from "@/data/korea/photo-picks.json";
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

// 대표 사진을 직접 고른 곳 (사용자 10/23: 사진이 너무 일상적 → 관광사진 갤러리 후보를 눈으로 비교해 골랐다)
const HERO: Record<string, PlacePhoto> = {
  gyeongbokgung: { src: "https://tong.visitkorea.or.kr/cms2/website/03/3551003.jpg", credit: "한국관광공사 · 서문교", license: "공공누리 제1유형", alt: "경복궁" },
  haeundae: { src: "https://tong.visitkorea.or.kr/cms2/website/59/3414759.jpg", credit: "한국관광공사 · 이명재", license: "공공누리 제1유형", alt: "해운대 일몰" },
  eworld: { src: "https://tong.visitkorea.or.kr/cms2/website/02/2951602.jpg", credit: "한국관광공사 · 앙지뉴 필름", license: "공공누리 제1유형", alt: "이월드" },
  // UI QA 13차: 홍대는 낮 거리 → 밤 네온, 서울대공원은 케이블카 → 장미정원 항공
  "hongdae": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Hongdae%2C_Seoul-_Part_II_-_Hongdae2237.jpg/1920px-Hongdae%2C_Seoul-_Part_II_-_Hongdae2237.jpg", credit: "lumoplank / Wikimedia Commons", license: "CC0", page: "https://commons.wikimedia.org/wiki/File:Hongdae,_Seoul-_Part_II_-_Hongdae2237.jpg" },
  "seoul-grand-park": { src: "https://tong.visitkorea.or.kr/cms2/website/12/3539212.jpg", credit: "한국관광공사 · 김지연", license: "공공누리 제1유형" },
};

// Claude가 후보 사진을 보고 고른 순서 (경수님 10/29, scripts/korea-data/photo-pick.mts): 흐림·안내도·글자 이미지는 빼고 점수 순, 첫 장이 대표.
// 있으면 위 목록 대신 이 순서를 쓴다 (직접 고른 HERO는 그대로 맨 앞)
const PICKS = picks as Record<string, { photos: PlacePhoto[] }>;

/** 장소의 고해상도 사진 (모자라면 빈 배열 → 기존 사진을 쓴다). 관광공사 전문 사진이 있으면 앞에, 겹치는 주소는 한 번 */
export function placePhotos(id: string): PlacePhoto[] {
  const own = (PHOTOS[id] ?? []).map((p) => ({ ...p, src: clean(p.src) }));
  const base = PICKS[id]?.photos.length
    ? PICKS[id].photos.map(({ src, w, h, credit, license, page, alt }) => ({ src: clean(src), w, h, credit, license, page, alt }))
    : KEEP_HERO.has(id) && own.length ? [own[0], ...proPhotos(id), ...own.slice(1)] : [...proPhotos(id), ...own];
  const ordered = HERO[id] ? [HERO[id], ...base] : base;
  const list = ordered.filter(
    (p, i, arr) => arr.findIndex((x) => x.src === p.src) === i,
  );
  return list.length >= MIN ? list.slice(0, 12) : [];
}

/** 카드·목록에 쓰는 대표 사진: 새 사진의 첫 장, 없으면 기존 대표 사진 */
export function heroImage(place: Pick<Place, "id" | "image">): string | undefined {
  return placePhotos(place.id)[0]?.src ?? place.image;
}
