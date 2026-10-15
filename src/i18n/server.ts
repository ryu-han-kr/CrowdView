// 서버 컴포넌트용: 언어별 사전을 불러와 t를 만든다
import { isLang, type Lang } from "./config";
import en from "./dict/en";
import ja from "./dict/ja";
import zhCN from "./dict/zh-CN";
import zhTW from "./dict/zh-TW";
import { makeT, type Dict, type T } from "./translate";

const DICTS: Partial<Record<Lang, Dict>> = { en, ja, "zh-CN": zhCN, "zh-TW": zhTW };

export function getDict(lang: Lang): Dict {
  return DICTS[lang] ?? {};
}

export function getT(lang: string): T {
  return makeT(isLang(lang) ? getDict(lang) : undefined);
}
