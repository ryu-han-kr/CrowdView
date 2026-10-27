"use client";

// 언어별 사전 제공자를 next/dynamic 으로 나눠 싣는다 (10/27 성능).
// 레이아웃에서 사전 객체를 prop 으로 넘기면 110KB(gz 37KB)가 화면마다 HTML 의 RSC 데이터로 함께 내려갔다
// → 언어별 JS 조각(해시 주소, 1년 캐시)으로 바꿔 두 번째 화면부터는 받지 않는다. 한국어는 사전이 없어 그대로.
// 서버 렌더링은 그대로 되고(ssr 기본값), 브라우저는 조각을 받은 뒤 hydrate 한다.
import dynamic from "next/dynamic";
import { I18nProvider } from "./client";
import type { Lang } from "./config";

const PROVIDERS = {
  en: dynamic(() => import("./providers/en")),
  ja: dynamic(() => import("./providers/ja")),
  "zh-CN": dynamic(() => import("./providers/zh-CN")),
  "zh-TW": dynamic(() => import("./providers/zh-TW")),
} as const;

export function LazyI18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  if (lang === "ko") return <I18nProvider lang="ko" dict={{}}>{children}</I18nProvider>;
  const Provider = PROVIDERS[lang];
  return <Provider>{children}</Provider>;
}
