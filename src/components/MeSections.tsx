"use client";

import Link from "@/i18n/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { usePicks, usePlans } from "@/lib/prefs";

/** 공유 코스는 30일 보관 (lib/route-share) */
const KEEP_DAYS = 30;

/** 마이페이지: 내 여행 계획 (추천 코스에서 저장한 코스) */
export function SavedPlans() {
  const { t, lang } = useI18n();
  const { plans, remove } = usePlans();
  const dateLabel = (d: string) =>
    new Intl.DateTimeFormat(lang, { month: "numeric", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  return (
    <section>
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-bold">🧭 {t("내 여행 계획")}</h2>
        <Link href="/route" className="text-xs font-semibold text-indigo-600">
          {t("새 코스 짜기")} ›
        </Link>
      </div>
      {plans.length ? (
        <ul className="mt-2 space-y-2">
          {plans.map((p) => {
            const left = KEEP_DAYS - Math.floor((Date.now() - Date.parse(p.savedAt)) / 86_400_000);
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white pr-2">
                <Link href={`/r/${p.id}`} className="min-w-0 flex-1 px-4 py-3">
                  <span className="block text-xs font-semibold text-indigo-500">
                    {dateLabel(p.day)} · {t("{name}에서 출발", { name: p.start })}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold">{p.stops.join(" → ")}</span>
                  {left <= 7 && (
                    <span className="block text-[11px] text-amber-600">{t("코스 링크는 {n}일 뒤 사라져요", { n: Math.max(0, left) })}</span>
                  )}
                </Link>
                <button onClick={() => remove(p.id)} aria-label={t("삭제")} className="px-2 text-gray-400">
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">{t("추천 코스 결과에서 ‘저장’을 누르면 여기에 모여요.")}</p>
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
      <h2 className="text-lg font-bold">⭐ {t("담은 곳")}</h2>
      {picks.length ? (
        <>
          <ul className="mt-2 flex flex-wrap gap-2">
            {picks.map((p) => (
              <li key={p.id} className="flex items-center rounded-full bg-amber-50 pr-1 text-sm">
                <Link href={p.href} className="py-1.5 pl-3 font-semibold text-amber-900">
                  {p.label}
                </Link>
                <button onClick={() => remove(p.id)} aria-label={t("삭제")} className="px-2 text-amber-700/60">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <Link href="/route" className="mt-3 inline-block text-xs font-semibold text-indigo-600">
            {t("담은 곳으로 코스 짜기")} ›
          </Link>
        </>
      ) : (
        <p className="mt-2 rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">{t("목록의 ☆를 누르면 가고 싶은 곳을 여기에 모아 둘 수 있어요")}</p>
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
      <h2 className="text-lg font-bold">⚙️ {t("설정")}</h2>
      <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white text-sm">
        <li className="flex items-center justify-between gap-3 px-4 py-3">
          <span>{t("화면 테마")}</span>
          <ThemePicker />
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
            <span className="block text-[11px] text-gray-400">{t("즐겨찾기·담은 곳·여행 계획·키워드 (로그인했다면 서버 것은 남아요)")}</span>
          </span>
          <button onClick={clearLocal} className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
            {done ? "✓" : t("지우기")}
          </button>
        </li>
      </ul>
    </section>
  );
}

/** 화면 테마: 자동(시스템) · 라이트 · 다크. html[data-theme]와 localStorage(cv:theme) */
function ThemePicker() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("auto");
  useEffect(() => {
    try {
      const v = localStorage.getItem("cv:theme");
      if (v === "light" || v === "dark") setTheme(v);
    } catch {}
  }, []);
  const pick = (v: "auto" | "light" | "dark") => {
    setTheme(v);
    try {
      if (v === "auto") localStorage.removeItem("cv:theme");
      else localStorage.setItem("cv:theme", v);
    } catch {}
    if (v === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = v;
  };
  return (
    <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold" suppressHydrationWarning>
      {(["auto", "light", "dark"] as const).map((v) => (
        <button
          key={v}
          onClick={() => pick(v)}
          aria-pressed={theme === v}
          className={`min-h-8 rounded-full px-3 py-1.5 ${theme === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
        >
          {v === "auto" ? t("자동") : v === "light" ? `☀️ ${t("라이트")}` : `🌙 ${t("다크")}`}
        </button>
      ))}
    </div>
  );
}
