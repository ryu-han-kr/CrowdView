"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { seasonSort, type Season } from "@/lib/season-order";
import { useI18n } from "@/i18n/client";
import { headcountInfo } from "@/lib/format";
import { placeHref } from "@/lib/place-href";
import { useFavorites } from "@/lib/prefs";
import { CATEGORY_LABEL, type Category, type CrowdResult, type Place } from "@/lib/types";
import { placeTag } from "@/lib/category-style";
import { levelOf } from "@/lib/levels";
import { matchScore } from "@/lib/search-match";
import { ListCard } from "./ListCard";
import type { PhotoCardItem } from "./home/PhotoRail";
import { SpotMap, ViewToggle } from "./map/SpotMap";
import { StickyBar } from "./StickyBar";
import { useUrlQuery } from "./useUrlQuery";
import { useHomeSearch } from "./search/useSearchData";
import { Glyph } from "@/components/Glyph";
import { SUBS_OF, SUB_EMOJI, SUB_LABEL, subOf, type SubCategory } from "@/lib/subcategory";
import { useSpots, type SpotRow } from "./MoreSpots";
import { EmptyState } from "@/components/EmptyState";
import { RoundChips } from "@/components/RoundChips";
import { ScrollRow } from "./ScrollRow";

/** 홈 통합 검색의 다른 탭 항목 (서버에서 만든 명소·축제·서울 지역) */
export interface SearchItem {
  id: string;
  href: string;
  img?: string;
  emoji?: string;
  title: string;
  sub?: string;
  /** 지역 칩 (서울·부산…) */
  region?: string;
  score?: number;
  badge?: string;
  tag?: { label: string; color: string; icon?: string };
  /** 검색에 함께 쓸 말 (한국어 이름 등) */
  keys?: string[];
}
export interface SearchData {
  /** 우리 장소(실시간·예측 혼잡도) — 맨 위 검색창 드롭다운용 (10/31) */
  places?: SearchItem[];
  landmarks: SearchItem[];
  festivals: SearchItem[];
  seoul: SearchItem[];
  /** 지역 칩 순서 (lib/korea REGIONS) */
  regions: string[];
}
type Tab = "all" | "live" | "landmark" | "festival" | "seoul" | "spot";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "live", label: "실시간 장소" },
  { id: "landmark", label: "명소" },
  { id: "festival", label: "축제" },
  { id: "seoul", label: "서울 지역" },
  { id: "spot", label: "관광지" },
];
const SPOT_PAGE = 12;

const LIVE_PAGE = 8;

type Filter = "all" | "fav" | Category;
type Sort = "calm" | "busy";

const CATEGORY_EMOJI: Record<Category, string> = {
  landmark: "🏯",
  street: "🛍️",
  themepark: "🎢",
  waterpark: "🌊",
  ski: "⛷️",
  indoor: "🕹️",
  beach: "🏖️",
  airport: "✈️",
  event: "🎆",
};
const CATEGORIES = Object.keys(CATEGORY_EMOJI) as Category[];
// 분류 칩의 대표 사진 장소 (없으면 그 분류에서 사진 있는 첫 장소)
const CATEGORY_FACE: Partial<Record<Category, string>> = {
  landmark: "gyeongbokgung",
  street: "hongdae",
  themepark: "everland",
  waterpark: "caribbean-bay",
  ski: "yongpyong",
  indoor: "smob-hanam",
  beach: "haeundae",
  airport: "icn-t1",
};

/**
 * 홈의 전체 장소: 검색 + 파트 칩 + 한산한/붐비는 순 + 목록(사진 카드)·지도 전환.
 * 검색 중이거나 파트를 고르면 추천 섹션(children)은 숨긴다
 */
/** 홈 목록이 쓰는 장소 필드만 (page.tsx가 이 모양으로 잘라 보낸다) */
export type HomePlace = Pick<Place, "id" | "name" | "category" | "region" | "lat" | "lng" | "emoji" | "tags" | "image" | "eventDate" | "eventEndDate">;

export function HomeList({
  places,
  crowd,
  withSearch = false,
  season,
  children,
}: {
  places: HomePlace[];
  crowd: Record<string, CrowdResult>;
  /** 계절에 맞춰 분류 칩 순서를 바꾼다 (겨울 스키장·여름 워터파크 앞으로) */
  season?: Season;
  /** 명소·축제·서울 지역 탭 (자료는 탭을 고르거나 검색할 때 /api/home-search/{lang} 에서 받는다) */
  withSearch?: boolean;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useUrlQuery();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // 통합 검색 탭 (사용자 10/22: 지역 여행 탭 대신 홈에서 한 번에) · 세부 분류 · 지역 칩
  const [tab, setTab] = useState<Tab>("all");
  const [sub, setSub] = useState<SubCategory | "all">("all");
  const [region, setRegion] = useState<string>("all");
  const [spotShown, setSpotShown] = useState(SPOT_PAGE);
  // 실시간 장소 목록도 12곳씩 (사용자 10/22: 45곳이 한 번에 늘어서 길고 조잡해 보임)
  const [liveShown, setLiveShown] = useState(LIVE_PAGE);
  const [sort, setSort] = useState<Sort>("calm");
  const [view, setView] = useState<"list" | "map">("list");
  const { favorites } = useFavorites();
  const i18n = useI18n();
  const { t } = i18n;

  // 홈 아이콘 메뉴의 '테마파크' 같은 링크: /?cat=themepark#places → 그 파트를 골라 목록으로
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat") as Category | null;
    if (cat && CATEGORIES.includes(cat)) {
      setFilter(cat);
      setTab("live");
      document.getElementById("places")?.scrollIntoView({ behavior: "smooth" });
    }
    const tb = params.get("tab") as Tab | null;
    if (tb && TABS.some((x) => x.id === tb)) {
      setTab(tb);
      document.getElementById("places")?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);
  const searching = query.trim() !== "";
  useEffect(() => {
    if (searching) setFilter("all");
  }, [searching]);

  useEffect(() => setSub("all"), [filter]);
  useEffect(() => setSpotShown(SPOT_PAGE), [region, query, tab]);
  useEffect(() => setLiveShown(LIVE_PAGE), [filter, sub, query, sort]);
  const q = query.trim().toLowerCase();
  // 띄어쓰기·낱말 순서·초성까지 보는 검색 (lib/search-match, 10/31 '남산 타워' → 남산 N서울타워). 검색 중엔 더 잘 맞는 곳이 위로
  const score = (xs: (string | undefined)[]) => matchScore(q, xs);
  const hit = (xs: (string | undefined)[]) => !q || score(xs) > 0;
  const byScore = <T,>(xs: T[], fields: (x: T) => (string | undefined)[]) =>
    q ? xs.map((x) => [score(fields(x)), x] as const).filter(([n]) => n > 0).sort((a, b) => b[0] - a[0]).map(([, x]) => x) : xs;
  const list = places
    .filter((p) => (filter === "all" ? true : filter === "fav" ? favorites.includes(p.id) : p.category === filter))
    .filter((p) => sub === "all" || subOf(p.id) === sub)
    .map((p) => {
      const sc = subOf(p.id);
      return { p, m: score([p.name, p.region, ...p.tags, CATEGORY_LABEL[p.category], ...(sc ? [SUB_LABEL[sc]] : [])].flatMap((s) => [s, t(s)])) };
    })
    .filter(({ m }) => m > 0)
    .sort(
      ({ p: a, m: ma }, { p: b, m: mb }) =>
        (q ? mb - ma : 0) || Number(crowd[b.id].open) - Number(crowd[a.id].open) || (sort === "calm" ? 1 : -1) * (crowd[a.id].score - crowd[b.id].score),
    )
    .map(({ p }) => p);

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
      tag: placeTag(p, t),
      favId: p.id,
      lat: p.lat,
      lng: p.lng,
    };
  });

  // 원형 사진 칩 (경수님 레퍼런스 10/27): 분류마다 대표 장소 사진
  const chips: { id: Filter; label: string; emoji: string; img?: string }[] = [
    { id: "all", label: t("전체"), emoji: "✨" },
    ...(favorites.length ? [{ id: "fav" as const, label: t("찜"), emoji: "❤️" }] : []),
    ...(season ? seasonSort(CATEGORIES, (c) => c, season) : CATEGORIES).filter((c) => places.some((p) => p.category === c)).map((c) => ({
      id: c,
      label: t(CATEGORY_LABEL[c]),
      emoji: CATEGORY_EMOJI[c],
      img: (places.find((p) => p.id === CATEGORY_FACE[c] && p.image) ?? places.find((p) => p.category === c && p.image))?.image,
    })),
  ];
  const browsing = !q && filter === "all" && view === "list" && tab === "all";
  const subs = filter !== "all" && filter !== "fav" ? (SUBS_OF[filter] ?? []).filter((x) => places.some((p) => p.category === filter && subOf(p.id) === x)) : [];

  // 다른 탭: 명소·축제·서울 지역(서버) + 관광지(브라우저가 /data/spots-{lang}.json 을 받는다)
  const needSpots = tab === "spot" || (tab === "all" && !!q);
  const spots = useSpots(needSpots);
  const search = useHomeSearch(withSearch && (!!q || (tab !== "all" && tab !== "live")));
  const inReg = (r?: string) => region === "all" || r === region;
  /* eslint-disable react-hooks/exhaustive-deps -- q·region에 따라 다시 거른다 */
  const landmarks = useMemo(() => byScore((search?.landmarks ?? []).filter((x) => inReg(x.region)), (x) => [x.title, x.sub, ...(x.keys ?? [])]), [search, region, q]);
  const festivals = useMemo(() => byScore((search?.festivals ?? []).filter((x) => inReg(x.region)), (x) => [x.title, x.sub, ...(x.keys ?? [])]), [search, region, q]);
  const seoulAreas = useMemo(() => byScore(search?.seoul ?? [], (x) => [x.title, x.sub, ...(x.keys ?? [])]), [search, q]);
  const spotItems: SearchItem[] = useMemo(
    () =>
      byScore(
        (spots ?? []).filter((s: SpotRow) => inReg(s[2])),
        (s: SpotRow) => [s[3], s[7], t(s[2])],
      ).map((s: SpotRow) => ({
          id: `spot-${s[0]}`,
          href:
            i18n.lang === "ko"
              ? `https://map.kakao.com/link/map/${encodeURIComponent(s[3])},${s[4]},${s[5]}`
              : `https://www.google.com/maps/search/?api=1&query=${s[4]},${s[5]}`,
          img: s[6],
          emoji: "📍",
          title: s[3],
          sub: [t(s[2]), s[7] ? t(s[7]) : undefined].filter(Boolean).join(" · "),
        })),
    [spots, region, q],
  );
  /* eslint-enable react-hooks/exhaustive-deps */
  const counts: Record<Tab, number> = {
    all: 0,
    live: list.length,
    landmark: landmarks.length,
    festival: festivals.length,
    seoul: seoulAreas.length,
    spot: spotItems.length,
  };
  const tabs = withSearch ? TABS : [];
  const regionChips = search && (tab === "landmark" || tab === "festival" || tab === "spot") ? search.regions : [];

  return (
    <>
      {/* 아이콘 바로 아래는 포토카드 모음, 탭·동그란 칩·전체 목록은 그 아래로 (경수님 10/28: 아이콘 줄과 칩 줄이 같은 기능처럼 두 번 나와 보였다).
          검색하거나 분류를 고르면 모음은 숨고 탭·결과가 아이콘 바로 아래로 온다 */}
      {browsing && children}
      <StickyBar id="places" className="-mx-5 mt-8 scroll-mt-16 px-5 pt-3 pb-3 md:mx-0 md:mt-10 md:px-0">
        {/* 위에 붙어 따라올 땐 검색창을 접고 탭 줄만 (UI QA 9차: 붙은 줄이 화면 1/3을 가렸다). 검색어가 있으면 그대로 */}
        {/* 휴대폰은 홈 머리의 검색창(HomeSearchInput) 하나만 (10/27 홈 2차) → 여기선 검색어 표시줄, 검색창은 PC */}
        {withSearch && query && (
          <div className="flex items-center gap-2 text-sm md:hidden">
            <span className="min-w-0 flex-1 truncate font-semibold">{t("'{q}' 검색 결과", { q: query })}</span>
            <button onClick={() => setQuery("")} className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
              {t("검색어 지우기")}
            </button>
          </div>
        )}
        <label
          className={`items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 ${withSearch ? "hidden md:flex" : "flex"}`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
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
        {tabs.length > 0 && (
          <div className="mt-3 flex items-end border-b border-gray-200">
          <div role="tablist" className="no-scrollbar -mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {tabs.map((x) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={tab === x.id}
                onClick={() => setTab(x.id)}
                className={`-mb-px shrink-0 border-b-[3px] px-3 pt-1 pb-2 text-[15px] font-bold transition-colors ${
                  tab === x.id ? "border-gray-900 text-gray-950" : "border-transparent text-gray-500 md:hover:text-gray-800"
                }`}
              >
                {t(x.label)}
                {q && x.id !== "all" && <span className="ml-1 text-xs font-semibold text-gray-500">{counts[x.id]}</span>}
              </button>
            ))}
          </div>
            {/* 붙었을 때만: 검색 돋보기 → 검색창 자리로 올라가 바로 입력 */}
            <button
              type="button"
              onClick={() => {
                const top = (document.getElementById("places")?.previousElementSibling as HTMLElement | null)?.getBoundingClientRect().top ?? 0;
                window.scrollTo({ top: window.scrollY + top - (window.innerWidth >= 768 ? 64 : 0) - 8, behavior: "smooth" });
                setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
              }}
              aria-label={t("검색")}
              className="mb-1.5 ml-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 group-data-[stuck=true]/sticky:flex"
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        {regionChips.length > 0 && (
          <ScrollRow className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {["all", ...regionChips].map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                aria-pressed={region === r}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
                  region === r ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                {r === "all" ? t("전국") : t(r)}
              </button>
            ))}
          </ScrollRow>
        )}
      </StickyBar>
        {/* 전체 탭에서도 보여, 분류를 고르면 실시간 장소 탭의 그 분류로 */}
        {(tab === "live" || tab === "all" || !withSearch) && (
          <RoundChips
            className="-mx-1 mt-4"
            items={chips}
            value={filter}
            onChange={(id) => {
              setFilter(id as Filter);
              if (tab === "all" && id !== "all" && id !== "fav") setTab("live");
            }}
          />
        )}
        {/* 세부 분류 (예: 테마파크 → 놀이공원·아쿠아리움·동물원·민속촌) */}
        {(tab === "live" || !withSearch) && subs.length > 0 && (
          <ScrollRow className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
            {(["all", ...subs] as const).map((x) => (
              <button
                key={x}
                onClick={() => setSub(x)}
                aria-pressed={sub === x}
                className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-bold ${
                  sub === x ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-800"
                }`}
              >
                {x !== "all" && <Glyph e={SUB_EMOJI[x]} className="h-3.5 w-3.5" />}
                {x === "all" ? t("전체") : t(SUB_LABEL[x])}
              </button>
            ))}
          </ScrollRow>
        )}

      {tab !== "all" && tab !== "live" && (
        <ResultList
          title={t(TABS.find((x) => x.id === tab)!.label)}
          count={counts[tab]}
          items={(tab === "landmark" ? landmarks : tab === "festival" ? festivals : tab === "seoul" ? seoulAreas : spotItems).slice(0, tab === "spot" ? spotShown : undefined)}
          loading={tab === "spot" && !spots}
          empty={q ? t("‘{q}’에 맞는 곳이 없어요.", { q: query }) : t("이 지역에는 아직 없어요.")}
          more={tab === "spot" && spotItems.length > spotShown ? () => setSpotShown((n) => n + SPOT_PAGE) : undefined}
        />
      )}

      {/* 전체 탭에서 검색하면: 다른 탭 결과를 4개씩 (누르면 그 탭으로) */}
      {tab === "all" &&
        q &&
        (
          [
            ["landmark", landmarks],
            ["festival", festivals],
            ["seoul", seoulAreas],
            ["spot", spotItems],
          ] as const
        ).map(
          ([id, items]) =>
            items.length > 0 && (
              <ResultList
                key={id}
                title={t(TABS.find((x) => x.id === id)!.label)}
                count={items.length}
                items={items.slice(0, 4)}
                more={items.length > 4 ? () => setTab(id) : undefined}
                moreLabel={t("전체 보기")}
              />
            ),
        )}

      {(tab === "all" || tab === "live") && (
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* '실내 액티비티'처럼 긴 이름은 두 줄로 (10/27: 휴대폰에서 '실내 …'로 잘렸다) */}
          <h2 className="line-clamp-2 min-w-0 text-lg leading-tight font-bold break-keep md:text-xl">
            {q
              ? t("검색 결과 {n}곳", { n: list.length })
              : filter === "all"
                ? t("전체 장소")
                : filter === "fav"
                  ? t("찜한 곳")
                  : t(CATEGORY_LABEL[filter])}
          </h2>
          <div className="ml-auto flex shrink-0 items-center gap-2">
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
          <EmptyState className="mt-4">{t("‘{q}’에 맞는 장소가 없어요.", { q: query })}</EmptyState>
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
          <>
          <ul className="sector mt-4 grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:grid-cols-2 lg:grid-cols-3">
            {cards.slice(0, liveShown).map((c) => (
              <li key={c.id}>
                <ListCard
                  item={{
                    href: c.href,
                    img: c.img,
                    emoji: c.emoji,
                    title: c.title,
                    sub: c.region,
                    tag: c.tag,
                    level: c.score !== undefined ? { label: t(levelOf(c.score).label), color: levelOf(c.score).color } : undefined,
                    people: c.people,
                    trend: c.trend,
                    badge: c.badge,
                    favId: c.favId,
                  }}
                />
              </li>
            ))}
          </ul>
          {cards.length > liveShown && (
            <button
              onClick={() => setLiveShown((n) => n + LIVE_PAGE)}
              className="mt-3 w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-800"
            >
              {t("더 보기 ({n}곳 더)", { n: cards.length - liveShown })}
            </button>
          )}
          </>
        )}
      </section>
      )}
    </>
  );
}

/** 다른 탭 결과: 회색 구역 안 가로 카드 */
function ResultList({
  title,
  count,
  items,
  loading,
  empty,
  more,
  moreLabel,
}: {
  title: string;
  count: number;
  items: SearchItem[];
  loading?: boolean;
  empty?: string;
  more?: () => void;
  moreLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold md:text-xl">
        {title} {!loading && <span className="text-base font-semibold text-gray-500">{t("{n}곳", { n: count })}</span>}
      </h2>
      {loading ? (
        <EmptyState pose="wait" className="mt-4">{t("불러오는 중…")}</EmptyState>
      ) : !items.length ? (
        <EmptyState className="mt-4">{empty}</EmptyState>
      ) : (
        <ul className="sector mt-4 grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((x) => {
            const lv = x.score !== undefined ? levelOf(x.score) : undefined;
            return (
              <li key={x.id}>
                <ListCard
                  item={{
                    href: x.href,
                    img: x.img,
                    emoji: x.emoji,
                    title: x.title,
                    sub: x.sub,
                    tag: x.tag,
                    level: lv ? { label: t(lv.label), color: lv.color } : undefined,
                    badge: lv ? undefined : x.badge,
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
      {more && (
        <button onClick={more} className="mt-3 w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-800">
          {moreLabel ?? t("더 보기")}
        </button>
      )}
    </section>
  );
}

