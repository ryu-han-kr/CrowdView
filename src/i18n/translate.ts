// 한국어 원문을 그대로 키로 쓰는 번역 함수. 사전에 없으면 원문(한국어)을 보여준다.
// 예: t("지금 혼잡도"), t("오늘은 {hour}가 가장 한산해요", { hour })
import { DEFAULT_LANG, type Lang } from "./config";

export type Dict = Record<string, string>;
export type T = (ko: string, params?: Record<string, string | number>) => string;

export function makeT(dict: Dict | undefined): T {
  return (ko, params) => {
    let s = dict?.[ko] ?? ko;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] === undefined ? m : String(params[k])));
    return s;
  };
}

/** 언어별 숫자·시간 표기 */
export function formatHour(h: number, lang: Lang = DEFAULT_LANG): string {
  const hh = Math.floor(h) % 24 === 0 && h >= 24 ? 24 : Math.floor(h) % 24;
  switch (lang) {
    case "en":
      return `${String(hh).padStart(2, "0")}:00`;
    case "ja":
      return `${hh}時`;
    case "zh-CN":
      return `${hh}点`;
    case "zh-TW":
      return `${hh}點`;
    default:
      return `${String(hh).padStart(2, "0")}시`;
  }
}

/** 12,000 → 1.2만 / 1.2万 / 1.2萬 / 12K */
export function compactNumber(n: number, lang: Lang = DEFAULT_LANG): string {
  if (lang === "en") {
    if (n < 1000) return n.toLocaleString("en");
    const k = n / 1000;
    return `${Number.isInteger(k) || k >= 100 ? Math.round(k) : k.toFixed(1)}K`;
  }
  if (n < 10_000) return n.toLocaleString();
  const man = n / 10_000;
  const v = Number.isInteger(man) ? man : man.toFixed(1);
  return `${v}${lang === "zh-TW" ? "萬" : lang === "ja" || lang === "zh-CN" ? "万" : "만"}`;
}
