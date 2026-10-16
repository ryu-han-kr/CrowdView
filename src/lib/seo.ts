// 검색엔진·공유 미리보기용 메타데이터: 정식 주소(canonical), 언어별 주소(hreflang), Open Graph, 구조화 데이터(JSON-LD)
import type { Metadata } from "next";
import { DEFAULT_LANG, LANGS, localePath, type Lang } from "@/i18n/config";

export const SITE = "https://crowdview.app";

const OG_LOCALE: Record<Lang, string> = { ko: "ko_KR", en: "en_US", ja: "ja_JP", "zh-CN": "zh_CN", "zh-TW": "zh_TW" };

/** 언어별 같은 페이지 주소 (x-default는 한국어) */
export function languageAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = Object.fromEntries(LANGS.map((l) => [l, `${SITE}${localePath(l, path)}`]));
  out["x-default"] = `${SITE}${localePath(DEFAULT_LANG, path)}`;
  return out;
}

/**
 * 페이지 메타데이터. path는 언어 접두사 없는 주소 (예: /seoul/POI001)
 * title 끝에 " | CrowdView"를 붙인다
 */
export function pageMeta({
  lang,
  path,
  title,
  description,
  image,
  noindex = false,
}: {
  lang: string;
  path: string;
  title?: string;
  description?: string;
  image?: string;
  noindex?: boolean;
}): Metadata {
  const l = (LANGS as readonly string[]).includes(lang) ? (lang as Lang) : DEFAULT_LANG;
  const url = `${SITE}${localePath(l, path)}`;
  return {
    ...(title && { title: { absolute: `${title} | CrowdView` } }),
    ...(description && { description }),
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      siteName: "CrowdView",
      url,
      locale: OG_LOCALE[l],
      ...(title && { title: `${title} | CrowdView` }),
      ...(description && { description }),
      ...(image && { images: [{ url: image }] }),
    },
    twitter: {
      card: "summary_large_image",
      ...(title && { title: `${title} | CrowdView` }),
      ...(description && { description }),
      ...(image && { images: [image] }),
    },
    ...(noindex && { robots: { index: false, follow: true } }),
  };
}

/** <script type="application/ld+json"> 에 넣을 문자열 (</script> 끊김 방지) */
export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");
