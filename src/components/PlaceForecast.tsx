"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/i18n/client";
import { levelOf, inkOf } from "@/lib/levels";
import { Glyph } from "@/components/Glyph";

export function UpcomingHours({ hours, bestHour }: { hours: { hour: number; label: string; score: number }[]; bestHour?: number }) {
  const { t } = useI18n();
  const ref = useRef<HTMLUListElement>(null);
  // 가장 한산한 시간이 줄 밖(오른쪽)에 있으면 그 칸이 보이게 넘겨 둔다 (사용자 10/23: 23시가 가장 한산한데 칸이 안 보였다)
  useEffect(() => {
    const ul = ref.current;
    const li = ul?.querySelector<HTMLElement>("[data-best]");
    if (ul && li && li.offsetLeft + li.offsetWidth > ul.clientWidth) ul.scrollLeft = li.offsetLeft + li.offsetWidth - ul.clientWidth + 8;
  }, [bestHour]);
  // 가로로 넘기는 줄: 키보드로도 넘길 수 있게 (axe scrollable-region-focusable). 고른 칸 테두리가 잘리지 않게 안쪽 여백
  return (
    <ul ref={ref} className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto p-0.5 pb-1" tabIndex={0} aria-label={t("시간대별 예상")}>
      {hours.map((h) => {
        const l = levelOf(h.score);
        const best = h.hour === bestHour;
        return (
          <li
            key={h.hour}
            data-best={best || undefined}
            className={`flex shrink-0 flex-col items-center rounded-xl px-3 py-2 ${best ? "ring-2 ring-emerald-500" : ""}`}
            style={{ background: `${l.color}1f` }}
            title={t(l.label)}
          >
            <span className="text-sm font-semibold text-gray-800">{h.label}</span>
            <span className="text-[13px] font-bold" style={{ color: inkOf(l.color) }}>
              {best ? <Glyph e="★" className="mr-0.5 h-3 w-3 text-amber-400" /> : null}
              {t(l.label)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
