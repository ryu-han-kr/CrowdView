// 세부 분류 꼬리표 (사용자 10/22: '테마파크'만으로는 아쿠아리움·놀이공원·민속촌이 섞여 찾기 어렵다)
// 장소 id → 세부 분류. 홈 목록의 둘째 칩 줄, 카드 꼬리표, 검색어에 쓴다
import type { Category } from "./types";

export type SubCategory =
  | "amusement"
  | "aquarium"
  | "zoo"
  | "folk"
  | "palace"
  | "tower"
  | "cafe-street"
  | "youth-street"
  | "fireworks"
  | "lights"
  | "indoor-waterpark"
  | "outdoor-waterpark";

export const SUB_LABEL: Record<SubCategory, string> = {
  amusement: "놀이공원",
  aquarium: "아쿠아리움",
  zoo: "동물원",
  folk: "민속촌",
  palace: "고궁",
  tower: "전망대",
  "cafe-street": "카페거리",
  "youth-street": "젊음의 거리",
  fireworks: "불꽃축제",
  lights: "빛축제",
  "indoor-waterpark": "실내 워터파크",
  "outdoor-waterpark": "야외 워터파크",
};

export const SUB_EMOJI: Record<SubCategory, string> = {
  amusement: "🎢",
  aquarium: "🐠",
  zoo: "🦁",
  folk: "🏘️",
  palace: "🏯",
  tower: "🗼",
  "cafe-street": "☕",
  "youth-street": "🎸",
  fireworks: "🎆",
  lights: "🏮",
  "indoor-waterpark": "🏊",
  "outdoor-waterpark": "🌊",
};

/** 상위 분류별로 고를 수 있는 세부 분류 (칩 순서) */
export const SUBS_OF: Partial<Record<Category, SubCategory[]>> = {
  themepark: ["amusement", "aquarium", "zoo", "folk"],
  landmark: ["palace", "tower"],
  street: ["cafe-street", "youth-street"],
  event: ["fireworks", "lights"],
  waterpark: ["outdoor-waterpark", "indoor-waterpark"],
};

const BY_ID: Record<string, SubCategory> = {
  lotteworld: "amusement",
  everland: "amusement",
  seoulland: "amusement",
  gyeongjuworld: "amusement",
  legoland: "amusement",
  eworld: "amusement",
  "lotteworld-busan": "amusement",
  oworld: "amusement",
  "gwangju-familyland": "amusement",
  "lotteworld-aquarium": "aquarium",
  "aquaplanet-ilsan": "aquarium",
  "aquaplanet-gwanggyo": "aquarium",
  "aquaplanet-jeju": "aquarium",
  "aquaplanet-yeosu": "aquarium",
  "sealife-busan": "aquarium",
  "seoul-grand-park": "zoo",
  "korean-folk-village": "folk",
  gyeongbokgung: "palace",
  namsan: "tower",
  seongsu: "cafe-street",
  hongdae: "youth-street",
  "seoul-fireworks": "fireworks",
  "busan-fireworks": "fireworks",
  "lantern-festival": "lights",
  "caribbean-bay": "outdoor-waterpark",
  "ocean-world": "outdoor-waterpark",
  "lotte-waterpark": "outdoor-waterpark",
  "california-beach": "outdoor-waterpark",
  "seorak-waterpia": "indoor-waterpark",
  "splas-resom": "indoor-waterpark",
};

export const subOf = (placeId: string): SubCategory | undefined => BY_ID[placeId];

/** 세부 분류 3D 아이콘 (public/icons/3d, Fluent Emoji MIT). 없으면 상위 분류 아이콘 */
export const SUB_ICON: Partial<Record<SubCategory, string>> = {
  amusement: "rollercoaster",
  aquarium: "sub-aquarium",
  zoo: "sub-zoo",
  folk: "sub-folk",
  palace: "sub-palace",
  tower: "sub-tower",
  "cafe-street": "sub-cafe",
  "youth-street": "sub-youth",
  fireworks: "sub-fireworks",
  lights: "sub-lights",
  "indoor-waterpark": "sub-swim",
  "outdoor-waterpark": "waterpark",
};
