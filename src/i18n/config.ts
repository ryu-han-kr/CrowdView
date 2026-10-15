// 지원 언어. 한국어는 주소에 접두사 없이(/), 나머지는 /en /ja /zh-CN /zh-TW 로 나뉜다.
export const LANGS = ["ko", "en", "ja", "zh-CN", "zh-TW"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "ko";

export const LANG_LABEL: Record<Lang, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
};

export const isLang = (v: string | undefined): v is Lang => !!v && (LANGS as readonly string[]).includes(v);

/** 언어별 주소. 한국어는 그대로, 그 외는 앞에 /언어 */
export function localePath(lang: Lang, path: string): string {
  if (lang === DEFAULT_LANG || !path.startsWith("/")) return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

/** 주소에서 언어 접두사를 떼어낸다 */
export function stripLang(pathname: string): { lang: Lang; path: string } {
  const seg = pathname.split("/")[1];
  if (isLang(seg) && seg !== DEFAULT_LANG) return { lang: seg, path: pathname.slice(seg.length + 1) || "/" };
  return { lang: DEFAULT_LANG, path: pathname };
}
