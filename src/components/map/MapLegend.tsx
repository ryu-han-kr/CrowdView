"use client";

import { useI18n } from "@/i18n/client";
import { LEVELS, inkOf } from "@/lib/levels";

/** 지도 위에 가로로 놓는 혼잡도 기준표: 단계마다 색 막대 · 이름 · 곳 수 */
export function MapLegend({ counts, className = "" }: { counts?: number[]; className?: string }) {
  const { t } = useI18n();
  return (
    <ul className={`flex overflow-hidden rounded-xl border border-gray-100 bg-white text-center text-[11px] leading-tight ${className}`}>
      {LEVELS.map((l) => (
        <li key={l.key} className="min-w-0 flex-1 border-t-[3px] px-1.5 py-1" style={{ borderTopColor: l.color }}>
          <b className="block truncate" style={{ color: inkOf(l.color) }}>
            {t(l.label)}
          </b>
          {counts && <span className="text-gray-500">{t("{n}곳", { n: counts[l.key - 1] })}</span>}
        </li>
      ))}
    </ul>
  );
}
