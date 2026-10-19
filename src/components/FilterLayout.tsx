"use client";

import Link from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import { usePicks, type Pick } from "@/lib/prefs";
import { Glyph } from "@/components/Glyph";

export interface FilterOption {
  id: string;
  label: string;
  emoji?: string;
  count?: number;
}
export interface FilterGroup {
  id: string;
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** 모바일에서도 칩 줄로 보일지 (기본: 보임) */
  mobile?: boolean;
}

/**
 * 목록 화면 공통 틀: 검색 + 거르기 + 고른 것 요약 + 담은 곳.
 * 태블릿·PC는 왼쪽 패널(상단 메뉴 아래에 붙어서 따라 내려옴), 모바일은 위쪽 검색창과 칩 줄 (앱 화면 그대로)
 */
export function FilterLayout({
  query,
  onQuery,
  placeholder,
  groups,
  resultCount,
  extra,
  children,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  groups: FilterGroup[];
  resultCount: number;
  /** 검색창 옆에 둘 버튼 (예: 내 주변) */
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const { picks, remove, clear } = usePicks();
  const chosen = groups.flatMap((g) => g.options.filter((o) => g.selected.includes(o.id)).map((o) => ({ g, o })));
  const active = chosen.length + (query.trim() ? 1 : 0);
  const resetAll = () => {
    onQuery("");
    groups.forEach((g) => g.onChange([]));
  };
  const toggle = (g: FilterGroup, id: string) => g.onChange(g.selected.includes(id) ? g.selected.filter((x) => x !== id) : [...g.selected, id]);
  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${on ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`;

  const search = (
    <label className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2.5">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
      </svg>
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
      />
      {query && (
        <button onClick={() => onQuery("")} aria-label={t("검색어 지우기")} className="text-gray-400">
          <Glyph e="✕" className="h-4 w-4" />
        </button>
      )}
    </label>
  );

  return (
    <div className="md:grid md:grid-cols-[250px_minmax(0,1fr)] md:items-start md:gap-8">
      {/* 태블릿·PC: 왼쪽 정리 패널 */}
      <aside className="no-scrollbar hidden md:sticky md:top-20 md:block md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto md:pb-6">
        {search}
        {extra && <div className="mt-2">{extra}</div>}

        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-indigo-900">
              {active ? t("{n}개 고름", { n: active }) : t("고른 조건 없음")} · {t("{n}곳", { n: resultCount })}
            </p>
            {active > 0 && (
              <button onClick={resetAll} className="text-xs font-semibold text-indigo-600">
                {t("초기화")}
              </button>
            )}
          </div>
          {active > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {query.trim() && (
                <li>
                  <button onClick={() => onQuery("")} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
                    “{query.trim()}” <Glyph e="✕" className="ml-0.5 h-3 w-3" />
                  </button>
                </li>
              )}
              {chosen.map(({ g, o }) => (
                <li key={`${g.id}:${o.id}`}>
                  <button onClick={() => toggle(g, o.id)} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
                    {o.emoji && <Glyph e={o.emoji} className="mr-1 h-[1em] w-[1em]" />}
                    {o.label} <Glyph e="✕" className="ml-0.5 h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {groups.map((g) => (
          <fieldset key={g.id} className="mt-5">
            <legend className="flex w-full items-center justify-between text-xs font-bold tracking-wide text-gray-500">
              {g.title}
              {g.selected.length > 0 && (
                <button onClick={() => g.onChange([])} className="font-semibold text-indigo-600">
                  {t("전체")}
                </button>
              )}
            </legend>
            <ul className={`mt-2 space-y-0.5 ${g.options.length > 10 ? "max-h-64 overflow-y-auto pr-1" : ""}`}>
              {g.options.map((o) => {
                const on = g.selected.includes(o.id);
                return (
                  <li key={o.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm ${on ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(g, o.id)} className="h-4 w-4 accent-indigo-600" />
                      <span className="min-w-0 flex-1 truncate">
                        {o.emoji && <Glyph e={o.emoji} className="mr-1 h-[1em] w-[1em]" />}
                        {o.label}
                      </span>
                      {o.count !== undefined && <span className="text-xs text-gray-400">{o.count}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}

        <PicksBox picks={picks} remove={remove} clear={clear} />
      </aside>

      <div>
        {/* 모바일: 검색 + 칩 줄 */}
        <div className="md:hidden">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">{search}</div>
            {extra}
          </div>
          {groups
            .filter((g) => g.mobile !== false)
            .map((g) => (
              <div key={g.id} className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                <button onClick={() => g.onChange([])} className={chip(!g.selected.length)}>
                  {t("전체")}
                </button>
                {g.options.map((o) => (
                  <button key={o.id} onClick={() => toggle(g, o.id)} className={chip(g.selected.includes(o.id))}>
                    {o.emoji && <Glyph e={o.emoji} className="mr-1 h-[1em] w-[1em]" />}
                    {o.label}
                    {o.count !== undefined && <span className="ml-1 text-xs opacity-60">{o.count}</span>}
                  </button>
                ))}
              </div>
            ))}
          {picks.length > 0 && (
            <p className="mt-3 rounded-2xl bg-indigo-50 px-4 py-2.5 text-xs text-indigo-800">
              <Glyph e="⭐" className="h-4 w-4 text-amber-400" /> {t("담은 곳 {n}곳", { n: picks.length })}: {picks.map((p) => p.label).join(", ")}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function PicksBox({ picks, remove, clear }: { picks: Pick[]; remove: (id: string) => void; clear: () => void }) {
  const { t } = useI18n();
  return (
    <section className="mt-6 rounded-2xl border border-gray-100 p-3.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-sm font-bold">
          <Glyph e="⭐" className="h-4 w-4 text-amber-400" /> {t("담은 곳 {n}곳", { n: picks.length })}
        </p>
        {picks.length > 0 && (
          <button onClick={clear} className="text-xs font-semibold text-gray-400">
            {t("비우기")}
          </button>
        )}
      </div>
      {picks.length ? (
        <ul className="mt-2 space-y-1">
          {picks.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <Link href={p.href} className="min-w-0 flex-1 truncate hover:text-indigo-600">
                {p.label}
              </Link>
              <button onClick={() => remove(p.id)} aria-label={t("빼기")} className="text-xs text-gray-400">
                <Glyph e="✕" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-gray-500">{t("목록의 ☆를 누르면 가고 싶은 곳을 여기에 모아 둘 수 있어요")}</p>
      )}
      {picks.length > 0 && (
        <Link href="/route" className="mt-3 block rounded-xl bg-indigo-600 py-2 text-center text-xs font-bold text-white">
          <Glyph e="🧭" /> {t("한산한 코스 짜러 가기")}
        </Link>
      )}
    </section>
  );
}

/** 목록 카드 오른쪽의 담기 별 */
export function PickStar({ pick }: { pick: Pick }) {
  const { t } = useI18n();
  const { has, toggle } = usePicks();
  const on = has(pick.id);
  return (
    <button
      onClick={() => toggle(pick)}
      aria-pressed={on}
      aria-label={on ? t("담기 취소") : t("담기")}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg leading-none ${on ? "text-amber-400" : "text-gray-300 hover:text-amber-300"}`}
    >
      <Glyph e={on ? "★" : "☆"} className={`h-5 w-5 ${on ? "text-amber-400" : ""}`} />
    </button>
  );
}
