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
