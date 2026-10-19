"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { headcountInfo } from "@/lib/format";
import { placeHref } from "@/lib/places";
import { useFavorites } from "@/lib/prefs";
import { CATEGORY_LABEL, type Category, type CrowdResult, type Place } from "@/lib/types";
import { PhotoCard, type PhotoCardItem } from "./home/PhotoRail";
import { SpotMap, ViewToggle } from "./map/SpotMap";
import { StickyBar } from "./StickyBar";
import { Glyph } from "@/components/Glyph";

type Filter = "all" | "fav" | Category;
type Sort = "calm" | "busy";

const CATEGORY_EMOJI: Record<Category, string> = {
  landmark: "🏯",
  street: "🛍️",
  themepark: "🎢",
  waterpark: "🌊",
  ski: "⛷️",
  beach: "🏖️",
  airport: "✈️",
  event: "🎆",
};
const CATEGORIES = Object.keys(CATEGORY_EMOJI) as Category[];

/**
 * 홈의 전체 장소: 검색 + 파트 칩 + 한산한/붐비는 순 + 목록(사진 카드)·지도 전환.
 * 검색 중이거나 파트를 고르면 추천 섹션(children)은 숨긴다
 */
export function HomeList({ places, crowd, children }: { places: Place[]; crowd: Record<string, CrowdResult>; children?: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("calm");
  const [view, setView] = useState<"list" | "map">("list");
  const { favorites } = useFavorites();
  const i18n = useI18n();
  const { t } = i18n;

  // 홈 아이콘 메뉴의 '테마파크' 같은 링크: /?cat=themepark#places → 그 파트를 골라 목록으로
  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get("cat") as Category | null;
    if (cat && CATEGORIES.includes(cat)) {
      setFilter(cat);
      document.getElementById("places")?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const q = query.trim().toLowerCase();
  const list = places
    .filter((p) => (filter === "all" ? true : filter === "fav" ? favorites.includes(p.id) : p.category === filter))
    .filter((p) => !q || [p.name, p.region, ...p.tags, CATEGORY_LABEL[p.category]].flatMap((s) => [s, t(s)]).some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => Number(crowd[b.id].open) - Number(crowd[a.id].open) || (sort === "calm" ? 1 : -1) * (crowd[a.id].score - crowd[b.id].score));

  const cards: (PhotoCardItem & { lat: number; lng: number; emoji: string })[] = list.map((p) => {
    const c = crowd[p.id];
    const hc = headcountInfo(c, i18n);
    return {
      id: p.id,
      href: placeHref(p),
      img: p.image,
      emoji: p.emoji,
      title: t(p.name),
      sub: [t(p.region), hc?.text].filter(Boolean).join(" · "),
      score: c.open ? c.score : undefined,
      badge: c.open ? undefined : t(c.offSeason ? "시즌 아님" : "운영 종료"),
      lat: p.lat,
      lng: p.lng,
    };
  });

  const chips: { id: Filter; label: string; emoji: string }[] = [
    { id: "all", label: t("전체"), emoji: "✨" },
    ...(favorites.length ? [{ id: "fav" as const, label: t("찜"), emoji: "❤️" }] : []),
    ...CATEGORIES.filter((c) => places.some((p) => p.category === c)).map((c) => ({ id: c, label: t(CATEGORY_LABEL[c]), emoji: CATEGORY_EMOJI[c] })),
  ];
  const browsing = !q && filter === "all" && view === "list";

  return (
    <>
      <StickyBar id="places" className="-mx-5 mt-8 scroll-mt-16 px-5 pt-3 pb-3 md:mx-0 md:mt-10 md:px-0">
        <label className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("장소·지역 검색 (예: 홍대, 공항)")}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-gray-400"
            enterKeyHint="search"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label={t("검색어 지우기")} className="text-gray-400">
              <Glyph e="✕" className="h-4 w-4" />
            </button>
          )}
        </label>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              aria-pressed={filter === c.id}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                filter === c.id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700 md:hover:border-gray-400"
              }`}
            >
              <Glyph e={c.emoji} />
              {c.label}
            </button>
          ))}
        </div>
      </StickyBar>

      {browsing && children}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-lg font-bold md:text-xl">
            {q
              ? t("검색 결과 {n}곳", { n: list.length })
              : filter === "all"
                ? t("전체 장소")
                : filter === "fav"
                  ? t("찜한 곳")
                  : t(CATEGORY_LABEL[filter])}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {view === "list" && (
              <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
                {(["calm", "busy"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`rounded-full px-3 py-1 ${sort === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
                  >
                    {s === "calm" ? t("한산한 순") : t("붐비는 순")}
                  </button>
                ))}
              </div>
            )}
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>
        {!list.length ? (
          <p className="mt-4 empty-note p-6 text-center">{t("‘{q}’에 맞는 장소가 없어요.", { q: query })}</p>
        ) : view === "map" ? (
          <SpotMap
            spots={cards.map((c) => ({
              id: c.id,
              name: c.title,
              lat: c.lat,
              lng: c.lng,
              href: c.href,
              score: c.score,
              emoji: c.emoji,
              sub: c.sub,
              img: c.img,
            }))}
            className="mt-4"
          />
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 md:gap-x-4 lg:grid-cols-5">
            {cards.map((c) => (
              <li key={c.id}>
                <PhotoCard item={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
