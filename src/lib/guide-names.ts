// 서울 여행 가이드 이름을 화면 언어로 (서버 전용). 그 언어 글이 없는 곳(약 290곳)은 한국어 이름이 그대로 나오던 것을
// 이름만이라도 번역해 보여 준다 (Papago, lib/name-translate 90일 캐시). 번역을 못 받으면 원문
import type { Lang } from "@/i18n/config";
import { translateNames } from "./name-translate";
import { guideText, type GuidePlace, type GuideText } from "./seoul-guide";

/** id → 이름 */
export async function guideNames(places: GuidePlace[], lang: Lang): Promise<Map<string, string>> {
  const picked = places.map((p) => ({ id: p.id, ...guideText(p, lang) }));
  const ko = picked.filter((x) => x.lang === "ko" && lang !== "ko").map((x) => x.text.n);
  const tr = ko.length ? await translateNames(ko, lang).catch(() => new Map<string, string>()) : new Map<string, string>();
  return new Map(picked.map((x) => [x.id, tr.get(x.text.n) ?? x.text.n]));
}

const lines = (s?: string) => s?.split("\n").map((x) => x.trim()).filter(Boolean) ?? [];

/** 그 언어 글이 없어 한국어로 보이는 가이드의 주소·운영·휴무·메뉴·가는 길 (10/31: 외국어 화면에 한국어 그대로였다). 이름은 원문 유지 */
export const guideTextParts = (t: GuideText) => [t.a, t.h, t.off, t.menu, ...lines(t.sub)];

export async function translateGuideText(text: GuideText, lang: Lang): Promise<GuideText> {
  const tr = await translateNames(guideTextParts(text), lang).catch(() => new Map<string, string>());
  const g = (s?: string) => (s ? (tr.get(s) ?? s) : s);
  return { ...text, a: g(text.a)!, h: g(text.h), off: g(text.off), menu: g(text.menu), sub: text.sub && lines(text.sub).map(g).join("\n") };
}
