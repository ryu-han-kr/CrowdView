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
  // 공유 미리보기 (카카오톡·페이스북 등): 페이지 사진이 없으면 사진 위 한글 제목 기본 썸네일 (public/og, 1200×630 JPG).
  // 사용자 10/23: 카톡 링크에 썸네일이 안 떴다 — 예전 기본 이미지(/ko/opengraph-image/…)가 308로 넘어가 수집기가 못 읽었다
  const img = image ?? `${SITE}/og/default-${l === "ko" ? "ko" : "en"}.jpg`;
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
      images: [{ url: img, ...(!image && { width: 1200, height: 630 }) }],
    },
    twitter: {
      card: "summary_large_image",
      ...(title && { title: `${title} | CrowdView` }),
      ...(description && { description }),
      images: [img],
    },
    ...(noindex && { robots: { index: false, follow: true } }),
  };
}

/** <script type="application/ld+json"> 에 넣을 문자열 (</script> 끊김 방지) */
export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");

/** 경로 구조화 데이터 (예: 홈 > 서울 실시간 > 경복궁). path는 언어 접두사 없는 주소 */
export function breadcrumbLd(lang: Lang, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE}${localePath(lang, it.path)}` })),
  };
}

/** 한국 시각 HH:MM (사실 문장의 기준 시각) */
export const kstClock = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(11, 16);
