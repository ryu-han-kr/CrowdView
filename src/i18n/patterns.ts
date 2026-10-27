// API가 한국어로 주는 이름 중 형식이 정해진 것을 번역한다 (출국장·주차장 이름 등)
import type { Lang } from "./config";
import { compactNumber, type T } from "./translate";

/** 인원: 12000 → 1.2만명 / 12K people … */
export const fmtPeople = (n: number, t: T, lang: Lang) => t("{n}명", { n: compactNumber(n, lang) });
/** 대기·소요 분 */
export const fmtMinutes = (n: number, t: T) => t("{n}분", { n });

/** 출국장 3 동편 → Departure Gate 3 East … (형식이 다르면 그대로) */
export function trZone(label: string, t: T): string {
  const m = label.match(/^출국장 (\d+)(?: (동편|서편|[A-Z]))?$/);
  if (!m) return t(label);
  const side = m[2] ? (m[2].length === 1 ? ` ${m[2]}` : ` ${t(m[2])}`) : "";
  return `${t("출국장 {n}", { n: m[1] })}${side}`;
}

// 주차장 이름 조각 (긴 것부터 바꾼다)
const PARKING_TOKENS = [
  "단기주차장",
  "장기주차장",
  "예약주차장",
  "주차타워",
  "주차빌딩",
  "주차장",
  "국내선",
  "국제선",
  "화물청사",
  "화물",
  "지상층",
  "장기",
  "단기",
  "지하",
  "지상",
];

/** 단기주차장 지하1층 → Short-term Parking B1F … */
export function trParking(name: string, t: T, lang: Lang): string {
  if (lang === "ko") return name;
  let out = name;
  for (const tok of PARKING_TOKENS) out = out.split(tok).join(` ${t(tok)} `);
  out = out.replace(/제(\d+)/g, (_, n) => t("제{n}", { n }));
  // 지하1층 → B1, 2층 → 2F, M층 → MF
  out = out.replace(/(\d+|M)층/g, (_, n) => (lang === "en" ? `${n}F` : t("{n}층", { n })));
  return out.replace(/\s+/g, " ").trim();
}

/** "서울 송파구" → "Seoul 송파구" (시도만 번역, 시군구 이름은 원문) */
export function trRegion(region: string, t: T): string {
  const [first, ...rest] = region.split(" ");
  return [t(first), ...rest].join(" ");
}

/** 예측 이유 표시: 템플릿과 값(공휴일 이름·날씨 단어 포함)을 함께 번역 */
export function trReason(r: { k: string; p?: Record<string, string | number> }, t: T): string {
  const p = r.p && Object.fromEntries(Object.entries(r.p).map(([k, v]) => [k, typeof v === "string" ? t(v) : v]));
  return t(r.k, p);
}

/** n분 전 갱신 등 */
export function fmtAge(minutes: number, t: T): string {
  if (minutes < 1) return t("방금 전");
  if (minutes < 60) return t("{n}분 전", { n: minutes });
  return t("{n}시간 전", { n: Math.floor(minutes / 60) });
}

// 공공시설 이름 조각 (서울시 화장실·와이파이 자료 수천 건은 통째 번역 대신 흔한 조각만 바꾼다, QA #17 10/27). 긴 것부터
const POI_TOKENS: [ko: string, en: string, ja: string, zh: string, tw: string][] = [
  ["공중화장실", "Public toilet", "公衆トイレ", "公共厕所", "公共廁所"],
  ["개방화장실", "Open toilet", "開放トイレ", "开放厕所", "開放廁所"],
  ["화장실", "Toilet", "トイレ", "厕所", "廁所"],
  ["지하철역", "Subway station", "地下鉄駅", "地铁站", "地鐵站"],
  ["주민센터", "Community center", "住民センター", "居民中心", "居民中心"],
  ["공영주차장", "Public parking", "公営駐車場", "公共停车场", "公共停車場"],
  ["주차장", "Parking", "駐車場", "停车场", "停車場"],
  ["어린이공원", "Children's park", "子ども公園", "儿童公园", "兒童公園"],
  ["근린공원", "Park", "近隣公園", "社区公园", "社區公園"],
  ["한강공원", "Hangang Park", "漢江公園", "汉江公园", "漢江公園"],
  ["공원", "Park", "公園", "公园", "公園"],
  ["시장", "Market", "市場", "市场", "市場"],
  ["도서관", "Library", "図書館", "图书馆", "圖書館"],
  ["문화센터", "Culture center", "文化センター", "文化中心", "文化中心"],
  ["체육관", "Gym", "体育館", "体育馆", "體育館"],
  ["운동장", "Stadium", "運動場", "运动场", "運動場"],
  ["버스정류장", "Bus stop", "バス停", "公交站", "公車站"],
  ["지하상가", "Underground mall", "地下商店街", "地下商街", "地下商街"],
  ["빌딩", "Building", "ビル", "大厦", "大廈"],
  ["광장", "Plaza", "広場", "广场", "廣場"],
  ["역", "Station", "駅", "站", "站"],
];
const POI_IDX: Record<string, number> = { en: 1, ja: 2, "zh-CN": 3, "zh-TW": 4 };
/** 공공시설 이름의 흔한 조각을 그 언어로 (예: 신촌역 공중화장실 → 신촌 Station Public toilet). 한국어면 그대로 */
export function trPoiName(name: string, lang: Lang): string {
  const i = POI_IDX[lang];
  if (!i) return name;
  let out = name;
  for (const row of POI_TOKENS) out = out.split(row[0]).join(` ${row[i]} `);
  return out.replace(/s+/g, " ").trim();
}
