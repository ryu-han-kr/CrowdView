"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { deepOf, inkOf, LEVELS, levelOf } from "@/lib/levels";

export interface CalCell {
  date: string;
  peakScore: number;
  /** 가장 붐빌 때 (예: 14시) */
  peakLabel: string;
  /** 예: 10/22 (목) */
  long: string;
  reasons: string[];
  people?: string;
}

/**
 * 앞으로 몇 주를 한눈에: 요일(줄) × 주(칸) 달력 히트맵. 월별·주별을 하나로 (사용자 QA 10/22, 레퍼런스: bklit UI 활동 달력).
 * 칸 색 = 그날 가장 붐빌 때의 단계. 칸을 누르면 아래에 그날 예상과 이유
 */
export function CalendarHeatmap({ cells, cell = 18 }: { cells: CalCell[]; cell?: number }) {
  const { t, lang } = useI18n();
  const [sel, setSel] = useState(0);
  if (!cells.length) return null;
  const dowOf = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
  // 월요일 시작 주 (bklit·깃허브처럼). 첫 주 앞은 빈칸
  const mon = (d: string) => (dowOf(d) + 6) % 7;
  const lead = mon(cells[0].date);
  const slots: (CalCell | null)[] = [...Array(lead).fill(null), ...cells];
  const weeks: (CalCell | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));
  const gap = Math.max(3, Math.round(cell / 6));
  const dayNames = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 5 + i))),
  );
  const monthName = (d: string) => new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const c = cells[Math.min(sel, cells.length - 1)];
  const lv = levelOf(c.peakScore);
  const calm = cells.reduce((a, b) => (b.peakScore < a.peakScore ? b : a));

  return (
    <div>
      <div className="no-scrollbar overflow-x-auto pb-1">
        <div className="inline-grid" style={{ gridTemplateColumns: `auto repeat(${weeks.length}, ${cell}px)`, columnGap: gap, rowGap: gap }}>
          {/* 달 이름 줄 */}
          <span />
          {weeks.map((w, i) => {
            // 첫 주, 또는 그 주에 1일이 들어 있으면 달 이름
            const firstDay = w.find((x) => x && x.date.endsWith("-01"));
            // 첫 주 이름은 다음 주에 바로 새 달이 시작하면 생략 (두 이름이 붙어 보이지 않게)
            const nextHasFirst = !!weeks[i + 1]?.some((x) => x?.date.endsWith("-01"));
            const label = firstDay ? monthName(firstDay.date) : i === 0 && !nextHasFirst ? monthName(w.find(Boolean)!.date) : "";
            return (
              <span key={i} className="text-[11px] font-semibold whitespace-nowrap text-gray-600" style={{ height: 16 }}>
                {label}
              </span>
            );
          })}
          {/* 요일 줄들 */}
          {dayNames.map((name, r) => (
            <Row key={name}>
              <span
                className="pr-1.5 text-right text-[11px] leading-none font-medium text-gray-600"
                style={{ height: cell, lineHeight: `${cell}px` }}
              >
                {r % 2 === 0 ? name : ""}
              </span>
              {weeks.map((w, i) => {
                const x = w[r];
                if (!x) return <span key={i} style={{ width: cell, height: cell }} />;
                const idx = cells.indexOf(x);
                const l = levelOf(x.peakScore);
                return (
                  <button
                    key={i}
                    onClick={() => setSel(idx)}
                    aria-label={`${x.long} ${t(l.label)}`}
                    aria-pressed={idx === sel}
                    className="rounded-[4px] transition hover:scale-110"
                    style={{
                      width: cell,
                      height: cell,
                      background: l.color,
                      opacity: 0.35 + (l.key - 1) * 0.16,
                      outline: idx === sel ? `2px solid ${deepOf(l.color)}` : idx === 0 ? "2px solid #111827" : undefined,
                      outlineOffset: 1,
                    }}
                  />
                );
              })}
            </Row>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gray-600">
        {t("한산")}
        {LEVELS.map((l) => (
          <span key={l.key} className="h-3 w-3 rounded-[3px]" style={{ background: l.color, opacity: 0.35 + (l.key - 1) * 0.16 }} />
        ))}
        {t("붐빔")}
        <span className="ml-auto">{t("검은 테두리 = 오늘")}</span>
      </div>

      {/* 고른 날 */}
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
          {t("이 기간 가장 한산한 날")}: <b className="text-gray-800">{calm.long}</b>
        </p>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
