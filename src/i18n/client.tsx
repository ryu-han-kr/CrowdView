"use client";

// 클라이언트 컴포넌트용: 레이아웃이 그 언어의 사전만 넘겨준다
import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LANG, localePath, type Lang } from "./config";
import { makeT, type Dict, type T } from "./translate";

interface I18n {
  lang: Lang;
  t: T;
  /** 언어 접두사를 붙인 주소 */
  lp: (path: string) => string;
}

const Ctx = createContext<I18n>({ lang: DEFAULT_LANG, t: makeT(undefined), lp: (p) => p });

export function I18nProvider({ lang, dict, children }: { lang: Lang; dict: Dict; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: makeT(dict), lp: (p: string) => localePath(lang, p) }), [lang, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
