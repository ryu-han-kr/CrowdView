"use client";

import { useState } from "react";
import { useFavorites } from "@/lib/prefs";
import { CATEGORY_LABEL, type Category, type CrowdResult, type Place } from "@/lib/types";
import { ICONS, IconTabBar, type IconTab } from "./IconTabs";
import { PlaceCard, PlaceRow } from "./PlaceRow";

type Filter = "all" | "fav" | Category;
type Sort = "calm" | "busy";

const CATEGORY_ICON: Record<Category, string> = {
  landmark: ICONS.landmark,
  street: ICONS.street,
  themepark: ICONS.themepark,
  beach: ICONS.beach,
  airport: ICONS.airport,
  event: ICONS.festival,
};
const CATEGORIES = Object.keys(CATEGORY_ICON) as Category[];
const HEART = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z";

/** 검색 → 카테고리 → 목록. 검색 중이거나 카테고리를 고르면 추천 섹션(children)은 숨긴다 */
export function HomeList({
  places,
  crowd,
  children,
}: {
  places: Place[];
  crowd: Record<string, CrowdResult>;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("calm");
  const { favorites } = useFavorites();

  const q = query.trim().toLowerCase();
  const list = places
    .filter((p) => (filter === "all" ? true : filter === "fav" ? favorites.includes(p.id) : p.category === filter))
    .filter((p) => !q || [p.name, p.region, ...p.tags, CATEGORY_LABEL[p.category]].some((s) => s.toLowerCase().includes(q)))
    .sort(
      (a, b) =>
        Number(crowd[b.id].open) - Number(crowd[a.id].open) ||
        (sort === "calm" ? 1 : -1) * (crowd[a.id].score - crowd[b.id].score),
    );

  const tabs: IconTab[] = [
    { id: "all", label: "전체", icon: ICONS.all },
    ...(favorites.length ? [{ id: "fav", label: "찜", icon: HEART }] : []),
    // 장소가 있는 파트만
    ...CATEGORIES.filter((c) => places.some((p) => p.category === c)).map((c) => ({ id: c, label: CATEGORY_LABEL[c], icon: CATEGORY_ICON[c] })),
  ];
  const browsing = !q && filter === "all";

  return (
    <>
      <div className="sticky top-0 z-20 -mx-5 bg-white/95 px-5 pt-3 pb-2 backdrop-blur md:top-16 md:mx-0 md:px-0">
        <label className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="장소·지역 검색 (예: 홍대, 공항)"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-gray-400"
            enterKeyHint="search"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="검색어 지우기" className="text-gray-400">
              ✕
            </button>
          )}
        </label>
        <IconTabBar tabs={tabs} active={filter} onChange={(id) => setFilter(id as Filter)} className="-mx-2 mt-2" />
      </div>

      {browsing && children}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{q ? `검색 결과 ${list.length}곳` : filter === "all" ? "전체 장소" : filter === "fav" ? "찜한 곳" : CATEGORY_LABEL[filter]}</h2>
          <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-medium">
            {(["calm", "busy"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`rounded-full px-3 py-1 ${sort === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
              >
                {s === "calm" ? "한산한 순" : "붐비는 순"}
              </button>
            ))}
          </div>
        </div>
        {list.length ? (
          <>
            {/* 모바일: 한 줄 목록 / 태블릿·PC: 사진 카드 그리드 */}
            <ul className="mt-1 divide-y divide-gray-100 md:hidden">
              {list.map((p) => (
                <li key={p.id}>
                  <PlaceRow place={p} crowd={crowd[p.id]} />
                </li>
              ))}
            </ul>
            <ul className="mt-4 hidden gap-5 md:grid md:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <li key={p.id}>
                  <PlaceCard place={p} crowd={crowd[p.id]} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4 rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">
            &lsquo;{query}&rsquo;에 맞는 장소가 없어요.
          </p>
        )}
      </section>
    </>
  );
}
