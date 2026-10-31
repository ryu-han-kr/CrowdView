"use client";

// 맨 위 검색창 + 치는 동안 바로 아래로 뜨는 결과판 (경수님 10/31 시안 ②: 포털처럼. 휴대폰은 홈 머리, PC는 모든 화면의 상단 메뉴줄).
// 장소·명소 / 서울 실시간 지역 / 축제·행사를 사진·지금 혼잡도와 함께 보여 주고, 누르면 바로 그 화면. Enter·'전체 결과'는 홈 목록 검색으로.
// 시안 ①(누르기만 했을 때 최근 검색·많이 찾는 곳)은 보관 — 지금은 글자를 쳐야 열린다
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import { stripLang } from "@/i18n/config";
import { Glyph } from "@/components/Glyph";
import { inkOf, levelOf } from "@/lib/levels";
import { highlightMask, matchScore } from "@/lib/search-match";
import type { SearchItem } from "@/components/HomeList";
import { useUrlQuery } from "@/components/useUrlQuery";
import { useHomeSearch } from "./useSearchData";

const LIMIT = { place: 5, seoul: 3, festival: 3 };

function Hl({ text, q }: { text: string; q: string }) {
  const mask = highlightMask(q, text);
  const parts: { s: string; on: boolean }[] = [];
  [...text].forEach((c, i) => {
    const last = parts[parts.length - 1];
    if (last && last.on === mask[i]) last.s += c;
    else parts.push({ s: c, on: mask[i] });
  });
  return (
    <>
      {parts.map((p, i) =>
        p.on ? (
          <b key={i} className="text-indigo-600">
            {p.s}
          </b>
        ) : (
          <span key={i}>{p.s}</span>
        ),
      )}
    </>
  );
}

export function SearchBox({ variant, className = "" }: { variant: "mobile" | "desktop"; className?: string }) {
  const { t, lp } = useI18n();
  const router = useRouter();
  const onHome = stripLang(usePathname()).path === "/";
  const [q, setQ] = useUrlQuery();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [top, setTop] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  // 홈 목록 검색어(주소 ?q=)가 바뀌면 검색창에도 (뒤로 오기·새로고침)
  useEffect(() => {
    if (onHome) setText(q);
  }, [q, onHome]);

  const query = text.trim();
  const open = focused && query !== "";
  const data = useHomeSearch(focused);

  const groups = useMemo(() => {
    if (!data || !query) return [];
    const rank = (xs: SearchItem[]) =>
      xs
        .map((x) => [matchScore(query, [x.title, ...(x.keys ?? [])]), x] as const)
        .filter(([n]) => n > 0)
        // 더 잘 맞는 곳 → 지금 혼잡도를 아는 곳
        .sort((a, b) => b[0] - a[0] || Number(b[1].score !== undefined) - Number(a[1].score !== undefined))
        .map(([, x]) => x);
    const seen = new Set<string>();
    const places = rank([...(data.places ?? []), ...data.landmarks]).filter((x) => !seen.has(x.href) && seen.add(x.href));
    return [
      { key: "place", label: t("장소"), items: places, emoji: "📍" },
      { key: "seoul", label: t("서울 실시간 지역"), items: rank(data.seoul), emoji: "📍" },
      { key: "festival", label: t("축제·행사"), items: rank(data.festivals), emoji: "🎪" },
    ].filter((g) => g.items.length);
  }, [data, query, t]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const shown = groups.map((g) => ({ ...g, items: g.items.slice(0, LIMIT[g.key as keyof typeof LIMIT]) }));
  const flat = shown.flatMap((g) => g.items);

  useEffect(() => setActive(-1), [query]);
  // 휴대폰: 결과판을 화면 양옆 끝까지 (검색창 옆 로고·언어 단추 폭까지 넓게)
  useEffect(() => {
    if (!open || variant !== "mobile") return;
    const place = () => setTop((input.current?.getBoundingClientRect().bottom ?? 0) + 10);
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, { passive: true });
    return () => {
      removeEventListener("resize", place);
      removeEventListener("scroll", place);
    };
  }, [open, variant]);
  // 바깥을 누르면 닫는다
  useEffect(() => {
    if (!focused) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [focused]);

  const done = () => {
    setFocused(false);
    input.current?.blur();
  };
  /** 홈 목록에서 전체 결과 보기 */
  const showAll = () => {
    done();
    if (onHome) {
      setQ(query);
      requestAnimationFrame(() => document.getElementById("places")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } else router.push(lp(`/?q=${encodeURIComponent(query)}#places`));
  };

  const mobile = variant === "mobile";
  return (
    <div ref={wrap} className={`relative min-w-0 ${mobile ? "flex-1" : ""} ${className}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && flat[active]) {
            done();
            router.push(lp(flat[active].href));
          } else if (query) showAll();
        }}
        className={`flex items-center gap-2 rounded-full bg-white transition-shadow ${
          mobile ? "border-2 border-indigo-500 px-4 py-2" : "border border-gray-200 px-3.5 py-2 hover:border-gray-300"
        } ${focused ? "shadow-[0_0_0_4px_rgb(99_102_241/0.18)]" : ""}`}
      >
        {!mobile && <Glyph e="🔍" className="h-4 w-4 shrink-0 text-gray-500" />}
        <input
          ref={input}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") done();
            else if (e.key === "ArrowDown" && flat.length) {
              e.preventDefault();
              setActive((i) => (i + 1) % flat.length);
            } else if (e.key === "ArrowUp" && flat.length) {
              e.preventDefault();
              setActive((i) => (i <= 0 ? flat.length - 1 : i - 1));
            }
          }}
          placeholder={t("장소·지역 검색")}
          aria-label={t("장소·지역 검색")}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          enterKeyHint="search"
          autoComplete="off"
          // 입력칸 자체의 포커스 테두리는 끈다 — 바깥 알약에 보라 빛 테두리가 대신 켜진다.
          // 인라인으로: globals.css의 공통 포커스 테두리는 레이어 밖이라 Tailwind outline-none보다 앞선다
          style={{ outline: "none" }}
          className={`min-w-0 flex-1 bg-transparent placeholder:text-gray-500 [&::-webkit-search-cancel-button]:hidden ${mobile ? "text-[15px]" : "text-sm"}`}
        />
        {text ? (
          <button
            type="button"
            onClick={() => {
              setText("");
              if (onHome && q) setQ("");
              input.current?.focus();
            }}
            aria-label={t("검색어 지우기")}
            className="shrink-0 text-gray-500"
          >
            <Glyph e="✕" className="h-4 w-4" />
          </button>
        ) : (
          mobile && <Glyph e="🔍" className="h-5 w-5 shrink-0 text-indigo-600" />
        )}
      </form>

      {open && (
        <>
          {/* 휴대폰: 뒤 화면을 어둡게 (누르면 닫힘) */}
          {mobile && <div aria-hidden className="fixed inset-x-0 bottom-0 z-40 bg-gray-900/35" style={{ top: top - 10 }} onPointerDown={done} />}
          <div
            id={listId}
            role="listbox"
            className={`z-50 max-h-[70vh] overflow-y-auto rounded-2xl bg-white py-2 shadow-[0_14px_36px_rgb(17_24_39/0.22)] ring-1 ring-gray-100 ${
              mobile ? "fixed inset-x-3" : "absolute top-full right-0 mt-2 w-[440px] max-w-[calc(100vw-2rem)]"
            }`}
            style={mobile ? { top } : undefined}
          >
            {!data ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">{t("불러오는 중…")}</p>
            ) : !total ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">{t("‘{q}’에 맞는 곳이 없어요.", { q: query })}</p>
            ) : (
              <>
                {shown.map((g) => (
                  <div key={g.key}>
                    <p className="px-4 pt-2.5 pb-1 text-xs font-bold text-gray-500">{g.label}</p>
                    {g.items.map((x) => {
                      const i = flat.indexOf(x);
                      const lv = x.score !== undefined ? levelOf(x.score) : undefined;
                      return (
                        <Link
                          key={x.href}
                          id={`${listId}-${i}`}
                          role="option"
                          aria-selected={i === active}
                          href={x.href}
                          onClick={done}
                          onPointerEnter={() => setActive(i)}
                          className={`flex items-center gap-3 px-4 py-2 ${i === active ? "bg-indigo-50/70" : ""}`}
                        >
                          {x.img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={x.img} alt="" loading="lazy" decoding="async" className="h-11 w-11 shrink-0 rounded-xl bg-gray-100 object-cover" />
                          ) : (
                            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xl">
                              {x.emoji ?? g.emoji}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold text-gray-900">
                              <Hl text={x.title} q={query} />
                            </span>
                            {x.sub && <span className="mt-0.5 block truncate text-xs text-gray-500">{x.sub}</span>}
                          </span>
                          {lv ? (
                            <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${lv.color}26`, color: inkOf(lv.color) }}>
                              {t(lv.label)}
                            </span>
                          ) : (
                            x.badge && <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{x.badge}</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ))}
                <button type="button" onClick={showAll} className="mt-1 block w-full border-t border-gray-100 px-4 pt-3 pb-1.5 text-center text-sm font-bold text-indigo-600">
                  {t("‘{q}’ 전체 결과 {n}곳 보기", { q: query, n: total })} →
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
