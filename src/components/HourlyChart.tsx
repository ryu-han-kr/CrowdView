import { levelOf } from "@/lib/levels";
import type { HourPoint } from "@/lib/types";

/** 시간대별 혼잡도 막대 그래프. 예측 구간은 빗금으로 구분 */
export function HourlyChart({ points, highlightHour }: { points: HourPoint[]; highlightHour?: number }) {
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {points.map((p) => {
          const level = levelOf(p.score);
          const isNow = p.hour === highlightHour;
          return (
            <div key={p.hour} className="relative flex h-full flex-1 flex-col justify-end">
              {isNow && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-1 text-[9px] font-bold whitespace-nowrap text-white">
                  지금
                </span>
              )}
              <div
                title={`${p.hour}시 · ${level.label}${p.forecast ? " (예측)" : ""}`}
                className={`rounded-t-[4px] ${p.forecast ? "forecast-bar opacity-60" : ""} ${isNow ? "ring-2 ring-gray-900 ring-offset-1" : ""}`}
                style={{ height: `${Math.max(4, p.score)}%`, background: level.color }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px] text-[10px] text-gray-400">
        {points.map((p) => (
          <span key={p.hour} className="flex-1 text-center">
            {p.hour % 3 === 0 ? p.hour : ""}
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-gray-400" /> 실측
        </span>
        <span className="flex items-center gap-1">
          <span className="forecast-bar h-2.5 w-2.5 rounded-sm bg-gray-400 opacity-60" /> AI 예측
        </span>
      </div>
    </div>
  );
}
