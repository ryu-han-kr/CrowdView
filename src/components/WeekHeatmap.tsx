"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatHour } from "@/i18n/translate";
import { LEVELS, levelOf } from "@/lib/levels";
import { Glyph } from "@/components/Glyph";

export interface HeatDay {
  date: string;
  /** 줄 이름 (오늘·내일·목) */
  label: string;
  /** 운영 시간의 시간마다 예상 점수 */
  hours: { hour: number; score: number }[];
  /** 정기 휴무 */
  closed?: boolean;
}

/**
 * 이번 주 × 시간 히트맵: "언제 가면 한산할까"를 한눈에. 칸 색 = 단계, 누르면 그 칸 설명.
 * 가장 한산한 칸(오늘 지난 시간 제외)에 ★. 휴대폰에서도 누르기 쉽게 칸 최소 26px
 */
export function WeekHeatmap({ days, nowHour }: { days: HeatDay[]; nowHour: number }) {
  const { t, lang } = useI18n();
  const all = days.flatMap((d) => d.hours.map((h) => h.hour));
  const from = all.length ? Math.min(...all) : 0;
  const to = all.length ? Math.max(...all) : -1;
  const cols = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  // 앞으로 남은 칸 중 가장 한산한 곳
  let best: { d: number; hour: number; score: number } | null = null;
  days.forEach((d, di) =>
    d.hours.forEach((h) => {
      if (di === 0 && h.hour < Math.floor(nowHour)) return;
      if (!best || h.score < best.score) best = { d: di, hour: h.hour, score: h.score };
    }),
  );
  const b = best as { d: number; hour: number; score: number } | null;
  const [sel, setSel] = useState<{ d: number; hour: number } | null>(b ? { d: b.d, hour: b.hour } : null);
  if (!all.length) return null;
  const selDay = sel ? days[sel.d] : undefined;
  const selScore = selDay?.hours.find((h) => h.hour === sel!.hour)?.score;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <table className="w-full border-separate" style={{ borderSpacing: 3, minWidth: cols.length * 22 + 44 }}>
          <thead>
            <tr>
              <th />
              {cols.map((h) => (
                <th key={h} className="text-center text-[11px] font-medium text-gray-500">
                  {h % 3 === 0 ? h : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, di) => (
              <tr key={d.date}>
                <th scope="row" className="pr-1 text-left text-xs font-semibold whitespace-nowrap text-gray-700">
                  {d.label}
                </th>
                {d.closed ? (
                  <td colSpan={cols.length} className="rounded-lg bg-gray-100 text-center text-xs text-gray-500">
                    {t("휴무")}
                  </td>
                ) : (
                  cols.map((h) => {
                    const cell = d.hours.find((x) => x.hour === h);
                    if (!cell) return <td key={h} className="h-7 rounded-md bg-gray-50" />;
                    const l = levelOf(cell.score);
                    const past = di === 0 && h < Math.floor(nowHour);
                    const on = sel?.d === di && sel.hour === h;
                    const isBest = b?.d === di && b.hour === h;
                    return (
                      <td key={h} className="p-0">
                        <button
                          onClick={() => setSel({ d: di, hour: h })}
                          aria-label={`${d.label} ${formatHour(h, lang)} ${t(l.label)}`}
                          aria-pressed={on}
                          className={`flex h-7 w-full min-w-[20px] items-center justify-center rounded-md text-[11px] transition ${
                            on ? "ring-2 ring-gray-900 ring-offset-1" : ""
                          }`}
                          style={{ background: l.color, opacity: past ? 0.25 : 0.35 + (cell.score / 100) * 0.65 }}
                        >
                          {isBest && <Glyph e="★" className="h-3.5 w-3.5 text-white drop-shadow" />}
                        </button>
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selDay && selScore !== undefined && (
        <p className="mt-2 rounded-2xl bg-gray-50 px-4 py-2.5 text-[15px]">
          <b>
            {selDay.label} {formatHour(sel!.hour, lang)}
          </b>{" "}
          · <b style={{ color: levelOf(selScore).color }}>{t(levelOf(selScore).label)}</b>{" "}
          <span className="text-sm text-gray-500">{t("혼잡 지수 {n}", { n: selScore })}</span>
          {b && sel!.d === b.d && sel!.hour === b.hour && <span className="ml-1.5 text-sm font-semibold text-emerald-600">★ {t("이번 주 가장 한산")}</span>}
        </p>
      )}

      {/* 범례 */}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
        {LEVELS.map((l) => (
          <span key={l.key} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color, opacity: 0.35 + (l.min / 100 + 0.1) * 0.65 }} />
            {t(l.label)}
          </span>
        ))}
      </div>
    </div>
  );
}
