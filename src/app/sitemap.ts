import type { MetadataRoute } from "next";
import { getFestivals, festivalHref } from "@/lib/festivals";
import { PLACES, placeHref } from "@/lib/places";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { SITE, languageAlternates } from "@/lib/seo";
import { GUIDE, GUIDE_SYNCED_AT } from "@/lib/seoul-guide";

// 축제 목록이 6시간마다 바뀌어 하루 몇 번만 다시 만든다
export const revalidate = 21600;

/** 모든 페이지 × 언어별 주소 (구글·네이버 검색 등록용) */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const synced = new Date(GUIDE_SYNCED_AT);
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
  const festivalPaths = [...new Set(festivals.map(festivalHref))].filter((p) => p.startsWith("/festival/"));

  return [
    entry("/", "hourly", 1),
    entry("/seoul", "hourly", 0.9),
    entry("/route", "daily", 0.8),
    entry("/guide", "weekly", 0.8),
    entry("/explore", "daily", 0.8),
    entry("/methodology", "monthly", 0.6, new Date("2026-10-17T00:00:00+09:00")),
    entry("/accuracy", "daily", 0.5),
    entry("/near", "weekly", 0.7),
    // 가이드는 주 1회 데이터 갱신 시각
    ...GUIDE.map((p) => entry(`/guide/${p.id}`, "weekly", 0.5, synced)),
    entry("/events", "daily", 0.9),
    entry("/airport", "hourly", 0.8),
    entry("/map", "hourly", 0.7),
    ...PLACES.map((p) => entry(placeHref(p), "hourly", 0.8)),
    ...SEOUL_AREAS.map((a) => entry(`/seoul/${a.code}`, "hourly", 0.7)),
    ...festivalPaths.map((p) => entry(p, "daily", 0.6)),
    entry("/pricing", "monthly", 0.4),
    entry("/terms", "yearly", 0.2),
    entry("/privacy", "yearly", 0.2),
    entry("/refund", "yearly", 0.2),
  ];
}
