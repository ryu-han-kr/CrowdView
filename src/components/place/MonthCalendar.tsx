"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { inkOf, levelOf, tintInkOf } from "@/lib/levels";
import type { CalCell } from "./CalendarHeatmap";

/**
 * 한 달 달력 (사용자 10/23: 석 달 달력 대신 보통 달력 모양). 이번 주 월요일부터 5주(35일), 칸마다 날짜 + 그날 가장 붐빌 때의 단계.
 * big: '더 보기' 창 — 칸이 커지고 칸 안에 예상 인원·붐비는 시각까지
 */
export function MonthCalendar({ cells, big = false }: { cells: CalCell[]; big?: boolean }) {
  const { t, lang } = useI18n();
  const [sel, setSel] = useState(0);
  if (!cells.length) return null;
  const mon = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
  const lead = mon(cells[0].date);
  const slots: (CalCell | null)[] = [...Array(lead).fill(null), ...cells].slice(0, 35);
  const dayNames = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 5 + i))),
  );
  const c = cells[Math.min(sel, cells.length - 1)];
  const lv = levelOf(c.peakScore);
  const shown = slots.filter((x): x is CalCell => !!x);
  const calm = [...shown].sort((a, b) => a.peakScore - b.peakScore).slice(0, 3);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {dayNames.map((n, i) => (
          <span key={n} className={`pb-1 text-xs font-semibold ${i === 5 ? "text-blue-700" : i === 6 ? "text-red-600" : "text-gray-500"}`}>
            {n}
          </span>
        ))}
        {slots.map((x, i) => {
          if (!x) return <span key={i} />;
          const idx = cells.indexOf(x);
          const l = levelOf(x.peakScore);
          const d = Number(x.date.slice(8, 10));
          return (
            <button
              key={x.date}
              onClick={() => setSel(idx)}
              aria-label={`${x.long} ${t(l.label)}`}
              aria-pressed={idx === sel}
              className={`flex flex-col items-center rounded-xl transition active:scale-95 ${big ? "min-h-[72px] gap-1 px-0.5 py-2" : "gap-0.5 py-1.5"} ${
                idx === sel ? "ring-2 ring-gray-900" : idx === 0 ? "ring-1 ring-gray-400" : ""
              }`}
              style={{ background: `${l.color}2b` }}
            >
              <span className="text-[13px] leading-none font-bold text-gray-900">
                {d === 1 || i === lead ? `${Number(x.date.slice(5, 7))}/${d}` : d}
              </span>
              <span
                className={`text-center leading-tight font-extrabold tracking-tight break-keep ${big ? "text-[12px]" : "text-[10px]"}`}
                style={{ color: tintInkOf(l.color) }}
              >
                {t(l.label)}
              </span>
              {/* 더 보기: 그날 가장 붐빌 때 예상 값 (칸이 좁아 '대기 약'·'약'은 뗀다. 시각은 아래 상자에) */}
              {big && x.people && (
                <span className="text-[11px] leading-tight font-semibold whitespace-nowrap text-gray-800">{x.people.replace(/^(대기 )?약 /, "")}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="sector-box mt-3 border border-gray-100">
        <p className="text-sm font-semibold text-gray-700">
          {c.long} · {t("가장 붐빌 때 {hour}", { hour: c.peakLabel })}
        </p>
        <p className="mt-0.5 text-xl font-extrabold" style={{ color: inkOf(lv.color) }}>
          {t(lv.label)} {c.people && <span className="text-base font-bold text-gray-800">{c.people}</span>}
        </p>
        {c.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.reasons.map((r) => (
              <span key={r} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                {r}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-gray-600">
          {t("이 기간 가장 한산한 날")}: <b className="text-gray-800">{calm.map((x) => x.long).join(", ")}</b>
        </p>
      </div>
    </div>
  );
}
