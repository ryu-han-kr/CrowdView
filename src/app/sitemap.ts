import type { MetadataRoute } from "next";
import { getFestivals, festivalHref } from "@/lib/festivals";
import { PLACES, placeHref } from "@/lib/places";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { SITE, languageAlternates } from "@/lib/seo";
import { GUIDE, GUIDE_SYNCED_AT } from "@/lib/seoul-guide";
import { LANDMARKS } from "@/lib/korea";
import { getDailyIndex } from "@/lib/archive-daily";
import { CROWD_PAGES } from "@/lib/crowd-pages";

// 축제 목록이 6시간마다 바뀌어 하루 몇 번만 다시 만든다
export const revalidate = 21600;

/** 모든 페이지 × 언어별 주소 (구글·네이버 검색 등록용) */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const synced = new Date(GUIDE_SYNCED_AT);
  // 명소 상세 자료(관광공사)를 마지막으로 받은 날
  const landmarksSynced = new Date("2026-10-17T19:00:00+09:00");
  const entry = (
    path: string,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: number,
    /** 실제로 내용이 바뀐 때 (없으면 지금 — 실시간 페이지) */
    lastModified: Date = now,
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages: languageAlternates(path) },
  });

  const festivals = await getFestivals(60).catch(() => []);
  // 지난 혼잡 기록: 정리된 기록이 있는 곳만 (lib/archive-daily)
  const history = await getDailyIndex().catch(() => []);
  const festivalPaths = [...new Set(festivals.map(festivalHref))].filter((p) => p.startsWith("/festival/"));

  return [
    entry("/", "hourly", 1),
    entry("/seoul", "hourly", 0.9),
    entry("/route", "daily", 0.8),
    entry("/guide", "weekly", 0.8),
    entry("/explore", "daily", 0.8),
    entry("/methodology", "monthly", 0.6, new Date("2026-10-17T00:00:00+09:00")),
    entry("/about", "monthly", 0.5, new Date("2026-10-30T00:00:00+09:00")),
    entry("/contact", "monthly", 0.4, new Date("2026-10-30T00:00:00+09:00")),
    entry("/accuracy", "daily", 0.5),
    // 질문형 검색 페이지 ("Is Myeongdong crowded right now?")
    entry("/crowd", "hourly", 0.8),
    ...CROWD_PAGES.map((p) => entry(`/crowd/${p.slug}`, "hourly", 0.7)),
    ...(history.length ? [entry("/history", "daily", 0.6)] : []),
    entry("/near", "weekly", 0.7),
    // 가이드는 주 1회 데이터 갱신 시각
    // 구글 서치콘솔 10/26: 3,110개가 '발견됨 – 색인 안 됨'. 새 사이트에 얇은 페이지가 많으면 핵심까지 늦어진다 →
    // 가이드는 사진이 있거나 명소인 것만(2,608 → 약 800), 지난 기록은 목록만 제출. 페이지 자체는 그대로 열려 있다
    ...GUIDE.filter((p) => p.img || p.kind === "attraction").map((p) => entry(`/guide/${p.id}`, "weekly", 0.5, synced)),
    entry("/events", "daily", 0.9),
    entry("/airport", "hourly", 0.8),
    entry("/map", "hourly", 0.7),
    ...PLACES.map((p) => entry(placeHref(p), "hourly", 0.8)),
    ...SEOUL_AREAS.map((a) => entry(`/seoul/${a.code}`, "hourly", 0.7)),
    // 명소 상세는 소개 글이 한국어뿐이라 한국어 주소만 (외국어 화면은 noindex)
    ...LANDMARKS.map((l) => ({ ...entry(`/spot/${l.id}`, "weekly", 0.6, landmarksSynced), alternates: undefined })),
    ...festivalPaths.map((p) => entry(p, "daily", 0.6)),
    entry("/pricing", "monthly", 0.4),
    entry("/terms", "yearly", 0.2),
    entry("/privacy", "yearly", 0.2),
    entry("/refund", "yearly", 0.2),
  ];
}
