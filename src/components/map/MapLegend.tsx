"use client";

import { useI18n } from "@/i18n/client";
import { LEVELS } from "@/lib/levels";

/** 지도 오른쪽 위에 붙는 작은 혼잡도 기준표 (색 · 단계 · 곳 수) */
export function MapLegend({ counts }: { counts?: number[] }) {
  const { t } = useI18n();
  return (
    <ul className="pointer-events-none absolute top-3 right-3 z-10 space-y-0.5 rounded-xl bg-white/95 px-2 py-1.5 text-[10px] leading-tight shadow-md backdrop-blur">
      {[...LEVELS].reverse().map((l) => (
        <li key={l.key} className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color }} />
          <span className="font-semibold text-gray-700">{t(l.label)}</span>
          {counts && <span className="ml-auto pl-1.5 text-gray-400">{counts[l.key - 1]}</span>}
        </li>
      ))}
    </ul>
  );
}
