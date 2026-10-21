"use client";

import Link from "@/i18n/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { usePicks, usePlans } from "@/lib/prefs";
import { Glyph } from "@/components/Glyph";
import { shareUrl } from "./ShareListButtons";

/** 공유 코스는 30일 보관 (lib/route-share) */
const KEEP_DAYS = 30;

/** 마이페이지: 내 여행 계획 (추천 코스에서 저장한 코스) */
export function SavedPlans() {
  const { t, lang, lp } = useI18n();
  const { plans, remove } = usePlans();
  const [copied, setCopied] = useState<string | null>(null);
  const share = async (id: string) => {
    if (await shareUrl(`${location.origin}${lp(`/r/${id}`)}`, t("한산한 코스"))) {
      setCopied(id);
      setTimeout(() => setCopied(null), 2500);
    }
  };
  const dateLabel = (d: string) =>
    new Intl.DateTimeFormat(lang, { month: "numeric", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  return (
    <section>
      <div className="flex items-end justify-between">
        <h2 className="flex items-center gap-1.5 text-lg font-bold">
          <Glyph e="🧭" className="h-5 w-5 text-indigo-500" /> {t("내 여행 계획")}
        </h2>
        <Link href="/route" className="text-xs font-semibold text-indigo-600">
          {t("새 코스 짜기")} ›
        </Link>
      </div>
      {plans.length ? (
        <ul className="mt-2 space-y-2">
          {plans.map((p) => {
            const left = KEEP_DAYS - Math.floor((Date.now() - Date.parse(p.savedAt)) / 86_400_000);
            return (
              <li key={p.id} className="card flex items-center gap-2 p-0 pr-2">
                <Link href={`/r/${p.id}`} className="min-w-0 flex-1 px-4 py-3">
                  <span className="block text-xs font-semibold text-indigo-500">
                    {dateLabel(p.day)} · {t("{name}에서 출발", { name: p.start })}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold">{p.stops.join(" → ")}</span>
                  {left <= 7 && (
                    <span className="block text-[11px] text-amber-700">{t("코스 링크는 {n}일 뒤 사라져요", { n: Math.max(0, left) })}</span>
                  )}
                </Link>
                {/* 다른 사람에게 코스 보내기 (공유 링크 /r/{id}) */}
                <button onClick={() => share(p.id)} aria-label={t("공유")} className="px-2 text-indigo-500">
                  {copied === p.id ? <span className="text-[11px] font-semibold">{t("복사됨")}</span> : <Glyph e="🔗" className="h-4 w-4" />}
                </button>
                <button onClick={() => remove(p.id)} aria-label={t("삭제")} className="px-2 text-gray-500">
                  <Glyph e="✕" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 empty-note">{t("추천 코스 결과에서 ‘저장’을 누르면 여기에 모여요.")}</p>
      )}
    </section>
  );
}

/** 마이페이지: 담은 곳 (서울 실시간·여행 가이드에서 ☆) */
export function MyPicks() {
  const { t } = useI18n();
  const { picks, remove } = usePicks();
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-lg font-bold">
        <Glyph e="⭐" className="h-5 w-5 text-amber-400" /> {t("담은 곳")}
      </h2>
      {picks.length ? (
        <>
          <ul className="mt-2 flex flex-wrap gap-2">
            {picks.map((p) => (
              <li key={p.id} className="flex items-center rounded-full bg-amber-50 pr-1 text-sm">
                <Link href={p.href} className="py-1.5 pl-3 font-semibold text-amber-900">
                  {p.label}
                </Link>
                <button onClick={() => remove(p.id)} aria-label={t("삭제")} className="px-2 text-amber-700/60">
                  <Glyph e="✕" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <Link href="/route" className="mt-3 inline-block text-xs font-semibold text-indigo-600">
            {t("담은 곳으로 코스 짜기")} ›
          </Link>
        </>
      ) : (
        <p className="mt-2 empty-note">{t("목록의 ☆를 누르면 가고 싶은 곳을 여기에 모아 둘 수 있어요")}</p>
      )}
    </section>
  );
}

/** 마이페이지: 설정 (이 기기에 저장된 것 지우기 등) */
export function MySettings() {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const clearLocal = () => {
    try {
      for (const k of ["cv:favorites", "cv:tags", "cv:picks", "cv:plans", "route:planner"]) {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      }
    } catch {}
    setDone(true);
    setTimeout(() => location.reload(), 600);
  };
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-lg font-bold">
        <Glyph e="⚙️" className="h-5 w-5 text-gray-500" /> {t("설정")}
      </h2>
      <ul className="mt-2 card divide-y divide-gray-100 p-0 text-sm">
        <li className="flex items-center justify-between gap-3 px-4 py-3">
          <span>{t("화면 테마")}</span>
          <ThemePicker />
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-3">
          <span>{t("글자 크기")}</span>
          <FontSizePicker />
        </li>
        <li className="flex items-center justify-between px-4 py-3">
          <span>{t("혼잡 알림")}</span>
          <a href="#alerts" className="text-xs font-semibold text-indigo-600">
            {t("관리")} ›
          </a>
        </li>
        <li className="flex items-center justify-between px-4 py-3">
          <span>{t("관심 키워드")}</span>
          <a href="#keywords" className="text-xs font-semibold text-indigo-600">
            {t("고르기")} ›
          </a>
        </li>
        <li className="flex items-center justify-between px-4 py-3">
          <span className="min-w-0">
            {t("이 기기에 저장된 정보 지우기")}
            <span className="block text-[11px] text-gray-500">{t("즐겨찾기·담은 곳·여행 계획·키워드 (로그인했다면 서버 것은 남아요)")}</span>
          </span>
          <button onClick={clearLocal} className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
            {done ? <Glyph e="✓" className="h-4 w-4" /> : t("지우기")}
          </button>
        </li>
      </ul>
    </section>
  );
}

/** 글자 크기: 보통 · 크게(112%) · 아주 크게(125%). html[data-font]와 localStorage(cv:font). 그래프·숫자까지 함께 커진다 (globals.css) */
function FontSizePicker() {
  const { t } = useI18n();
  const [size, setSize] = useState<"m" | "l" | "xl">("m");
  useEffect(() => {
    try {
      const v = localStorage.getItem("cv:font");
      if (v === "l" || v === "xl") setSize(v);
    } catch {}
  }, []);
  const pick = (v: "m" | "l" | "xl") => {
    setSize(v);
    try {
      if (v === "m") localStorage.removeItem("cv:font");
      else localStorage.setItem("cv:font", v);
    } catch {}
    if (v === "m") delete document.documentElement.dataset.font;
    else document.documentElement.dataset.font = v;
  };
  return (
    <div className="flex rounded-full bg-gray-100 p-0.5 font-semibold" suppressHydrationWarning>
      {(["m", "l", "xl"] as const).map((v) => (
        <button
          key={v}
          onClick={() => pick(v)}
          aria-pressed={size === v}
          aria-label={t(v === "m" ? "보통" : v === "l" ? "크게" : "아주 크게")}
          className={`min-h-8 rounded-full px-3 py-1 ${v === "m" ? "text-xs" : v === "l" ? "text-sm" : "text-base"} ${size === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
        >
          {t("가")}
        </button>
      ))}
    </div>
  );
}

/** 화면 테마: 라이트(기본) · 다크 · 자동(시스템 설정 따름). html[data-theme]와 localStorage(cv:theme) */
function ThemePicker() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("light");
  useEffect(() => {
    try {
      const v = localStorage.getItem("cv:theme");
      if (v === "auto" || v === "dark") setTheme(v);
    } catch {}
  }, []);
  const pick = (v: "auto" | "light" | "dark") => {
    setTheme(v);
    try {
      if (v === "light") localStorage.removeItem("cv:theme");
      else localStorage.setItem("cv:theme", v);
    } catch {}
    if (v === "light") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = v;
  };
  return (
    <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold" suppressHydrationWarning>
      {(["light", "dark", "auto"] as const).map((v) => (
        <button
          key={v}
          onClick={() => pick(v)}
          aria-pressed={theme === v}
          className={`min-h-8 rounded-full px-3 py-1.5 ${theme === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
        >
          {v === "auto" ? (
            t("자동")
          ) : (
            <>
              <Glyph e={v === "light" ? "☀️" : "🌙"} className="mr-1 h-3.5 w-3.5" />
              {v === "light" ? t("라이트") : t("다크")}
            </>
          )}
        </button>
      ))}
    </div>
  );
}
