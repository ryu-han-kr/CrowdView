"use client";

import Link from "@/i18n/link";
import { useEffect, useState } from "react";
import { FESTIVAL_CATEGORIES, festivalStatus, isLongRunning, type Festival, type FestivalCategory, type FestivalCrowd } from "@/lib/festivals";
import { useI18n } from "@/i18n/client";
import { fmtPeople, trRegion } from "@/i18n/patterns";
import { compactNumber } from "@/lib/format";
import type { SeoulLive } from "@/lib/seoul-live";
import { DataTag } from "./DataTag";
import { LevelBadge } from "./Level";
import { Glyph } from "@/components/Glyph";

const fmt = (d: string) => d.slice(5).replace("-", "/");

const EMOJI = Object.fromEntries(FESTIVAL_CATEGORIES.map((c) => [c.id, c.emoji])) as Record<FestivalCategory, string>;

/** 축제 목록 (지역·종류 필터 + 진행 중 / 다가오는 축제) */
export function FestivalList({
  festivals,
  crowds,
  lives,
  liveAreas,
  names = {},
  hrefs,
  today: serverToday,
}: {
  festivals: Festival[];
  crowds: Record<string, FestivalCrowd | null>;
  /** 진행 중인 서울 축제의 실시간 인구 */
  lives: Record<string, SeoulLive | null>;
  /** 서울시 실시간 지역에 연결된 축제 → 지역명 */
  liveAreas: Record<string, string>;
  /** 번역된 축제 이름·지역명 (한국어 원문 → 번역) */
  names?: Record<string, string>;
  hrefs: Record<string, string>;
  today: string;
}) {
  const { t, lang } = useI18n();
  const tr = (ko: string) => names[ko] ?? ko;
  const reg = (ko: string) => names[ko] ?? trRegion(ko, t);
  // 캐시된 페이지(최대 1시간)가 자정을 넘겨도 끝난 축제가 '진행 중'으로 남지 않게 브라우저의 한국 날짜로 다시 계산 (EVENT-07)
  const [today, setToday] = useState(serverToday);
  useEffect(() => setToday(new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)), []);
  festivals = festivals.filter((f) => festivalStatus(f, today) !== "ended");
  const [region, setRegion] = useState("전체");
  const [category, setCategory] = useState<FestivalCategory | "all">("all");
  // 축제 상세의 종류 링크(?type=food)로 들어오면 그 종류를 고른 채로 연다 (ISR 페이지라 클라이언트에서 읽는다)
  useEffect(() => {
    const type = new URLSearchParams(location.search).get("type");
    if (FESTIVAL_CATEGORIES.some((c) => c.id === type)) setCategory(type as FestivalCategory);
  }, []);
  const sidos = ["전체", ...new Set(festivals.map((f) => f.region.split(" ")[0]))];
  const inRegion = festivals.filter((f) => region === "전체" || f.region.startsWith(region));
  const list = inRegion.filter((f) => category === "all" || f.category === category);
  const cats = FESTIVAL_CATEGORIES.filter((c) => inRegion.some((f) => f.category === c.id));
  const ongoing = list.filter((f) => festivalStatus(f, today) === "ongoing" && !isLongRunning(f));
  const upcoming = list.filter((f) => festivalStatus(f, today) === "upcoming" && !isLongRunning(f));
  const longRunning = list.filter(isLongRunning);

  return (
    <>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {sidos.map((s) => (
          <button
            key={s}
            onClick={() => setRegion(s)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              s === region ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {s === "전체" ? t("전체") : t(s)}
            <span className="ml-1 text-xs opacity-60">
              {s === "전체" ? festivals.length : festivals.filter((f) => f.region.startsWith(s)).length}
            </span>
          </button>
        ))}
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
        {[{ id: "all" as const, label: "전체 종류", emoji: "" }, ...cats].map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[13px] font-medium ${
              c.id === category ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600"
            }`}
          >
            {c.emoji && <Glyph e={c.emoji} className="mr-1 h-[1em] w-[1em]" />}
            {t(c.label)}
            <span className="ml-1 text-xs opacity-60">{c.id === "all" ? inRegion.length : inRegion.filter((f) => f.category === c.id).length}</span>
          </button>
        ))}
      </div>
      {[
        { title: t("지금 진행 중"), items: ongoing },
        { title: t("다가오는 축제"), items: upcoming },
      ].map(
        (sec) =>
          sec.items.length > 0 && (
            <section key={sec.title} className="mt-6">
              <h2 className="text-lg font-bold">
                {sec.title} <span className="text-sm font-medium text-gray-400">{sec.items.length}</span>
              </h2>
              <ul className="mt-3 grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                {sec.items.map((f) => {
                  const c = crowds[f.id];
                  const live = lives[f.id];
                  const dday = Math.round((Date.parse(f.start) - Date.parse(today)) / 86_400_000);
                  return (
                    <li key={f.id}>
                      <Link
                        href={hrefs[f.id]}
                        className="flex h-full gap-3 rounded-3xl border border-gray-100 p-3 transition hover:shadow-md active:bg-gray-50"
                      >
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
                          {f.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-3xl">{EMOJI[f.category]}</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-sm font-semibold">{tr(f.title)}</p>
                            <span className="shrink-0 rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-bold text-white">
                              {dday <= 0 ? t("진행 중") : `D-${dday}`}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {fmt(f.start)}
                            {f.end !== f.start && ` ~ ${fmt(f.end)}`} · {reg(f.region)}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                            {live ? (
                              <>
                                <LevelBadge score={live.score} />
                                <span className="rounded bg-emerald-600 px-1 py-px text-[10px] font-bold text-white">{t("실시간")}</span>
                                <span>{t("{min}~{max}명", { min: compactNumber(live.min, lang), max: compactNumber(live.max, lang) })}</span>
                              </>
                            ) : c ? (
                              <>
                                <LevelBadge score={c.score} />
                                <DataTag />
                                <span>{t("작년 {pct}%", { pct: `${c.ratio >= 1 ? "+" : ""}${Math.round((c.ratio - 1) * 100)}` })}</span>
                              </>
                            ) : (
                              <span className="text-gray-400">
                                {liveAreas[f.id] ? t("시작하면 실시간 ({area})", { area: tr(liveAreas[f.id]) }) : t("혼잡 예측 준비 중")}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
      )}
      {longRunning.length > 0 && (
        <details className="mt-6 rounded-2xl border border-gray-100 p-4">
          <summary className="cursor-pointer text-sm font-bold">
            {t("상설·장기 행사")} <span className="font-medium text-gray-400">{longRunning.length}</span>
            <span className="ml-2 text-xs font-normal text-gray-500">{t("한 달 넘게 이어지는 공연·전시·투어")}</span>
          </summary>
          <ul className="mt-3 divide-y divide-gray-100">
            {longRunning.map((f) => (
              <li key={f.id}>
                <Link href={hrefs[f.id]} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">{tr(f.title)}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    ~{fmt(f.end)} · {reg(f.region)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      {list.length === 0 && (
        <p className="mt-8 text-center text-sm text-gray-500">
          {category === "all" ? t("이 지역에는 예정된 축제가 없어요.") : t("이 종류의 축제가 없어요.")}
        </p>
      )}
    </>
  );
}
