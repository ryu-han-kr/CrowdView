"use client";

import { useEffect, useRef, useState } from "react";
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
  // 칸을 누르면 그 시간의 자세한 예상이 아래에 열린다 (경수님 10/28: 시간·원활·보통 칸도 전부 누를 수 있게)
  const [picked, setPicked] = useState<number | undefined>();
  const sel = hours.find((h) => h.hour === picked);
  const bestRow = hours.find((h) => h.hour === bestHour);
  // 가로로 넘기는 줄: 키보드로도 넘길 수 있게 (axe scrollable-region-focusable). 고른 칸 테두리가 잘리지 않게 안쪽 여백
  return (
    <>
      <ul ref={ref} className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto p-0.5 pb-1" tabIndex={0} aria-label={t("시간대별 예상")}>
        {hours.map((h) => {
          const l = levelOf(h.score);
          const best = h.hour === bestHour;
          const on = h.hour === picked;
          return (
            <li key={h.hour} data-best={best || undefined} className="shrink-0">
              <button
                type="button"
                onClick={() => setPicked(on ? undefined : h.hour)}
                aria-pressed={on}
                className={`flex flex-col items-center rounded-xl px-3 py-2 transition active:scale-95 ${on ? "ring-2 ring-indigo-500" : best ? "ring-2 ring-emerald-500" : "hover:ring-1 hover:ring-gray-300"}`}
                style={{ background: `${l.color}1f` }}
              >
                <span className="text-sm font-semibold text-gray-800">{h.label}</span>
                <span className="text-[13px] font-bold" style={{ color: inkOf(l.color) }}>
                  {best ? <Glyph e="★" className="mr-0.5 h-3 w-3 text-amber-400" /> : null}
                  {t(l.label)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {sel && (
        <div className="mt-1.5 animate-[fade-in_0.2s_ease-out] rounded-xl bg-white px-3 py-2.5 text-sm text-gray-700" role="status">
          <p className="font-bold text-gray-900">
            {t("{hour} 예상 {level}", { hour: sel.label, level: t(levelOf(sel.score).label) })}
            <span className="ml-1.5 text-xs font-medium text-gray-500">{t("혼잡 점수 {n}/100", { n: Math.round(sel.score) })}</span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, sel.score))}%`, background: levelOf(sel.score).color }} />
          </div>
          <p className="mt-1.5 text-xs text-gray-600">
            {bestRow && bestRow.hour !== sel.hour
              ? t("가장 한산한 {hour}보다 {n}점 더 붐빌 것 같아요", { hour: bestRow.label, n: Math.max(0, Math.round(sel.score - bestRow.score)) })
              : t("오늘 남은 시간 중 가장 한산한 때예요")}
          </p>
        </div>
      )}
    </>
  );
}
