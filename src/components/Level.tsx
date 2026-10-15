"use client";

import { useI18n } from "@/i18n/client";
import { LEVELS, levelOf } from "@/lib/levels";

/** 5칸 막대 — 색 + 칸 수로 이중 표시해 색약 사용자도 구분 가능 */
export function LevelMeter({ score, className = "" }: { score: number; className?: string }) {
  const { t } = useI18n();
  const level = levelOf(score);
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-label={`${t("혼잡도")} ${t(level.label)}`}>
      {LEVELS.map((l) => (
        <span
          key={l.key}
          className="w-[5px] rounded-full"
          style={{
            height: `${6 + l.key * 3}px`,
            background: l.key <= level.key ? level.color : "#e5e7eb",
          }}
        />
      ))}
    </div>
  );
}

export function LevelBadge({ score, large = false, closed = false }: { score: number; large?: boolean; closed?: boolean }) {
  const { t } = useI18n();
  const level = closed ? { label: "운영 종료", color: "#9ca3af" } : levelOf(score);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full align-middle leading-none font-semibold whitespace-nowrap ${
        large ? "h-8 px-3 text-sm" : "h-6 px-2.5 text-xs"
      }`}
      style={{ color: level.color, background: `${level.color}1a` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: level.color }} />
      {t(level.label)}
    </span>
  );
}

export function LevelLegend() {
  const { t } = useI18n();
  return (
    <div className="flex overflow-hidden rounded-xl text-center text-[11px] font-medium">
      {LEVELS.map((l) => (
        <div key={l.key} className="flex h-7 flex-1 items-center justify-center leading-none" style={{ background: `${l.color}1f`, color: l.color }}>
          {t(l.label)}
        </div>
      ))}
    </div>
  );
}

export function TrendArrow({ trend }: { trend: "up" | "down" | "flat" }) {
  const { t } = useI18n();
  if (trend === "flat") return <span className="text-xs text-gray-400">→ {t("유지")}</span>;
  return trend === "up" ? (
    <span className="text-xs font-medium text-red-500">↑ {t("증가")}</span>
  ) : (
    <span className="text-xs font-medium text-emerald-600">↓ {t("감소")}</span>
  );
}
