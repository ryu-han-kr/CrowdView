"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { headcountInfo } from "@/lib/format";
import { placeHref } from "@/lib/places";
import { useFavorites } from "@/lib/prefs";
import { CATEGORY_LABEL, type Category, type CrowdResult, type Place } from "@/lib/types";
import Image from "next/image";
import Link from "@/i18n/link";
import { CATEGORY_TONE } from "@/lib/category-style";
import { inkOf, levelOf } from "@/lib/levels";
import type { PhotoCardItem } from "./home/PhotoRail";
import { SpotMap, ViewToggle } from "./map/SpotMap";
import { StickyBar } from "./StickyBar";
import { useUrlQuery } from "./useUrlQuery";
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
  const [query, setQuery] = useUrlQuery();
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

  // 닫힌 곳 표시: 행사는 열리기 전이면 'D-n', 끝났으면 '종료' (QA 10/21: 열리기 전 행사가 '운영 종료'로 보임)
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const closedLabel = (p: (typeof list)[number], offSeason?: boolean) => {
    if (p.category === "event" && p.eventDate) {
      if (p.eventDate > today) return `D-${Math.round((Date.parse(p.eventDate) - Date.parse(today)) / 86_400_000)}`;
      if ((p.eventEndDate ?? p.eventDate) < today) return t("종료");
    }
    return t(offSeason ? "시즌 아님" : "운영 종료");
  };
  const cards: (PhotoCardItem & { lat: number; lng: number; emoji: string; region: string; trend?: "up" | "down" | "flat" })[] = list.map((p) => {
    const c = crowd[p.id];
    const hc = headcountInfo(c, i18n);
    return {
      id: p.id,
      href: placeHref(p),
      img: p.image,
      emoji: p.emoji,
      title: t(p.name),
      sub: [t(p.region), hc?.text].filter(Boolean).join(" · "),
      region: t(p.region),
      people: hc?.text,
      trend: c.open ? c.trend : undefined,
      score: c.open ? c.score : undefined,
      badge: c.open ? undefined : closedLabel(p, c.offSeason),
      tag: { label: t(CATEGORY_LABEL[p.category]), ...CATEGORY_TONE[p.category] },
      favId: p.id,
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
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("장소·지역 검색 (예: 홍대, 공항)")}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-gray-500"
            enterKeyHint="search"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label={t("검색어 지우기")} className="text-gray-500">
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
                    className={`rounded-full px-3 py-1 ${sort === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
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
          // 사진 왼쪽 · 글 오른쪽 가로 카드를 회색 구역 안에 (사용자 QA 10/22: 왼쪽→오른쪽으로 읽히게, 배경으로 구별)
          <ul className="sector mt-4 grid gap-2.5 p-3 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <li key={c.id}>
                <ListCard item={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** 가로 카드: 사진(왼쪽) + 분류·이름·지역·지금 단계(오른쪽) + 찜 하트 */
function ListCard({ item }: { item: PhotoCardItem & { region: string; trend?: "up" | "down" | "flat" } }) {
  const { t } = useI18n();
  const { isFavorite, toggle } = useFavorites();
  const fav = item.favId ? isFavorite(item.favId) : false;
  const lv = item.score !== undefined ? levelOf(item.score) : undefined;
  return (
    <Link
      href={item.href}
      className="relative flex gap-3 rounded-2xl bg-white p-2.5 pr-3 shadow-[0_1px_2px_rgb(15_23_42/0.06)] transition active:scale-[0.99] md:hover:shadow-md"
    >
      <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {item.img ? (
          <Image src={item.img} alt="" fill sizes="208px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-indigo-400">
            <Glyph e={item.emoji ?? "📍"} className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        {item.tag && (
          <p className="flex items-center gap-1 text-[12px] font-extrabold" style={{ color: item.tag.color }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 작은 고정 아이콘 */}
            <img src={`/icons/3d/${item.tag.icon}.webp`} alt="" width={16} height={16} className="h-4 w-4" />
            {item.tag.label}
          </p>
        )}
        <p className="mt-0.5 truncate pr-8 text-base font-extrabold text-gray-950">{item.title}</p>
        <p className="truncate text-[13px] font-medium text-gray-600">{item.region}</p>
        <p className="mt-1.5 flex items-center gap-1.5 truncate">
          {lv ? (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: lv.color }} />
              <b className="text-[15px] font-extrabold" style={{ color: inkOf(lv.color) }}>
                {t(lv.label)}
              </b>
              {item.people && <span className="truncate text-[13px] font-bold text-gray-800">{item.people}</span>}
              {item.trend === "up" && <span className="shrink-0 text-xs font-bold text-red-600 dark:text-red-400">↑</span>}
              {item.trend === "down" && <span className="shrink-0 text-xs font-bold text-emerald-700">↓</span>}
            </>
          ) : (
            <b className="text-[14px] font-bold text-gray-600">{item.badge}</b>
          )}
        </p>
      </div>
      {item.favId && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(item.favId!);
          }}
          aria-label={fav ? t("즐겨찾기 해제") : t("즐겨찾기")}
          aria-pressed={fav}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full"
        >
          <Glyph e={fav ? "❤️" : "🤍"} className={`h-5 w-5 ${fav ? "text-rose-500" : "text-gray-400"}`} />
        </button>
      )}
    </Link>
  );
}
