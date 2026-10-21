// 서울 여행 가이드 이름을 화면 언어로 (서버 전용). 그 언어 글이 없는 곳(약 290곳)은 한국어 이름이 그대로 나오던 것을
// 이름만이라도 번역해 보여 준다 (Papago, lib/name-translate 90일 캐시). 번역을 못 받으면 원문
import type { Lang } from "@/i18n/config";
import { translateNames } from "./name-translate";
import { guideText, type GuidePlace } from "./seoul-guide";

/** id → 이름 */
export async function guideNames(places: GuidePlace[], lang: Lang): Promise<Map<string, string>> {
  const picked = places.map((p) => ({ id: p.id, ...guideText(p, lang) }));
  const ko = picked.filter((x) => x.lang === "ko" && lang !== "ko").map((x) => x.text.n);
  const tr = ko.length ? await translateNames(ko, lang).catch(() => new Map<string, string>()) : new Map<string, string>();
  return new Map(picked.map((x) => [x.id, tr.get(x.text.n) ?? x.text.n]));
}
