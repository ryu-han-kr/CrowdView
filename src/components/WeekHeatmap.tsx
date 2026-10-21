"use client";

import { useI18n } from "@/i18n/client";
import { deepOf, LEVELS, levelOf } from "@/lib/levels";

export interface HeatDay {
  date: string;
  /** 줄 이름 (오늘·내일·목) */
  label: string;
  /** 운영 시간의 시간마다 예상 점수 (+ 예상 인원 문장) */
  hours: { hour: number; score: number; people?: string }[];
  /** 정기 휴무 */
  closed?: boolean;
}

/** 2시간씩 묶은 칸 (운영 시간 안에서) */
const BLOCK = 2;

/**
 * 언제 가면 한산할까: 날(줄) × 2시간(칸) 표. 칸은 그 시간대 평균 단계의 색과 이름만 — 보자마자 초록 칸을 고르면 된다
 */
export function WeekHeatmap({ days, nowHour }: { days: HeatDay[]; nowHour: number }) {
  const { t } = useI18n();
  const all = days.flatMap((d) => d.hours.map((h) => h.hour));
  if (!all.length) return null;
  const from = Math.min(...all);
  const to = Math.max(...all) + 1;
  // 2시간씩 묶은 칸. 운영 시간이 길면(12시간 넘게) 3시간씩 — 휴대폰 한 화면에 들어가게
  const BLOCK = to - from > 12 ? 3 : 2;
  const blocks = Array.from({ length: Math.ceil((to - from) / BLOCK) }, (_, i) => from + i * BLOCK);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate text-center" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th />
              {blocks.map((b) => (
                <th key={b} className="px-0.5 pb-1 text-xs font-semibold whitespace-nowrap text-gray-500">
                  {b}~{Math.min(b + BLOCK, to)}
                  {t("시")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, di) => (
              <tr key={d.date}>
                <th scope="row" className="pr-1.5 text-left text-sm font-semibold whitespace-nowrap text-gray-800">
                  {d.label}
                </th>
                {d.closed ? (
                  <td colSpan={blocks.length} className="rounded-lg bg-gray-100 py-2 text-xs text-gray-500">
                    {t("휴무")}
                  </td>
                ) : (
                  blocks.map((b) => {
                    const hs = d.hours.filter((h) => h.hour >= b && h.hour < b + BLOCK);
                    // 오늘 이미 지난 시간대는 흐리게
                    const past = di === 0 && b + BLOCK <= Math.floor(nowHour);
                    if (!hs.length) return <td key={b} className="rounded-lg bg-gray-50" />;
                    const l = levelOf(Math.round(hs.reduce((a, h) => a + h.score, 0) / hs.length));
                    return (
                      <td
                        key={b}
                        className="rounded-lg py-2 text-[11px] font-bold whitespace-nowrap"
                        style={past ? { background: `${l.color}33`, color: "#4b5563" } : { background: l.color, color: deepOf(l.color) }}
                      >
                        {t(l.label)}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
        {LEVELS.map((l) => (
          <span key={l.key} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ background: l.color }} />
            {t(l.label)}
          </span>
        ))}
      </div>
    </div>
  );
}
