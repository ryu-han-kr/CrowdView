"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { inkOf, levelOf } from "@/lib/levels";
import { CalendarHeatmap, type CalCell } from "./CalendarHeatmap";

/**
 * 1년 (사용자 10/23: 탭에 1년도). 앞으로 12달의 달별 평균 붐빔 막대 + 달을 누르면 그달 가장 한산한·붐비는 날.
 * big: '더 보기' 창 — 365일 활동 달력까지
 */
export function YearOverview({ cells, big = false }: { cells: CalCell[]; big?: boolean }) {
  const { t, lang } = useI18n();
  const months = [...new Set(cells.map((c) => c.date.slice(0, 7)))].slice(0, 12).map((m) => {
    const days = cells.filter((c) => c.date.startsWith(m));
    const avg = Math.round(days.reduce((a, c) => a + c.peakScore, 0) / days.length);
    const sorted = [...days].sort((a, b) => a.peakScore - b.peakScore);
    return { m, days, avg, calm: sorted.slice(0, 3), busy: sorted.slice(-3).reverse() };
  });
  const [sel, setSel] = useState(0);
  if (!months.length) return null;
  const name = (m: string) => new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  const cur = months[Math.min(sel, months.length - 1)];
  const quiet = [...months].sort((a, b) => a.avg - b.avg)[0];
  // 달끼리 차이가 작아도 보이게: 가장 한산한 달 ~ 가장 붐비는 달 사이로 높이를 편다 (0부터 그리면 막대가 다 같아 보였다)
  const lo = Math.min(...months.map((x) => x.avg));
  const hi = Math.max(...months.map((x) => x.avg));
  const height = (avg: number) => (hi === lo ? 70 : 30 + ((avg - lo) / (hi - lo)) * 70);

  return (
    <div>
      <p className="mb-3 text-[15px] font-semibold">
        {/* 가장 덜 붐비는 달도 '혼잡'이면 '한산해요'가 어색하다 → '덜 붐벼요' */}
        {quiet.avg >= 60 ? t("앞으로 1년 중 {month}이 가장 덜 붐벼요", { month: name(quiet.m) }) : t("앞으로 1년 중 {month}이 가장 한산해요", { month: name(quiet.m) })}{" "}
        <span className="text-sm font-bold" style={{ color: inkOf(levelOf(quiet.avg).color) }}>
          {t(levelOf(quiet.avg).label)}
        </span>
      </p>
      <div className={`flex items-end gap-1 ${big ? "h-48" : "h-32"}`}>
        {months.map((x, i) => {
          const l = levelOf(x.avg);
          return (
            <button
              key={x.m}
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              aria-label={`${name(x.m)} ${t(l.label)}`}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span
                className={`w-full rounded-t-md transition ${i === sel ? "ring-2 ring-gray-900 ring-offset-1" : ""}`}
                style={{ height: `${height(x.avg)}%`, background: l.color, opacity: i === sel ? 1 : 0.75 }}
              />
              <span className={`text-[11px] font-semibold whitespace-nowrap ${i === sel ? "text-gray-900" : "text-gray-500"}`}>{name(x.m)}</span>
            </button>
          );
        })}
      </div>

      <div className="sector-box mt-3 border border-gray-100">
        <p className="text-sm font-semibold text-gray-700">
          {name(cur.m)} · {t("평균")}{" "}
          <b style={{ color: inkOf(levelOf(cur.avg).color) }}>{t(levelOf(cur.avg).label)}</b>
        </p>
        <p className="mt-1.5 text-[13px] text-gray-700">
          <b className="text-emerald-700">{t("한산한 날")}</b> {cur.calm.map((c) => c.long).join(", ")}
        </p>
        <p className="mt-0.5 text-[13px] text-gray-700">
          <b className="text-red-700">{t("붐비는 날")}</b> {cur.busy.map((c) => c.long).join(", ")}
        </p>
      </div>

      {big && (
        <div className="mt-6">
          <p className="mb-2 text-base font-extrabold">{t("365일 한눈에")}</p>
          <CalendarHeatmap cells={cells} cell={14} />
        </div>
      )}
    </div>
  );
}
