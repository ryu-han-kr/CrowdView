"use client";

import { useI18n } from "@/i18n/client";
import { LEVELS, levelOf, inkOf } from "@/lib/levels";

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

export function LevelBadge({
  score,
  large = false,
  closed = false,
  offSeason = false,
  event,
}: {
  score: number;
  large?: boolean;
  closed?: boolean;
  /** 계절 영업 장소의 비시즌 (스키장 등) */
  offSeason?: boolean;
  /** 행사 장소: 열리기 전이면 'D-n', 끝났으면 '종료' (운영 종료와 구분 — QA 10/21: 열리기 전 행사가 '운영 종료'로 보임) */
  event?: { start?: string; end?: string };
}) {
  const { t } = useI18n();
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const dday = event?.start ? Math.round((Date.parse(event.start) - Date.parse(today)) / 86_400_000) : undefined;
  const ended = !!event?.start && (event.end ?? event.start) < today;
  const level =
    closed && dday !== undefined && dday > 0
      ? { label: `D-${dday}`, color: "#6366f1" }
      : closed && ended
        ? { label: "종료", color: "#9ca3af" }
        : closed
          ? { label: offSeason ? "시즌 아님" : "운영 종료", color: "#9ca3af" }
          : levelOf(score);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full align-middle leading-none font-semibold whitespace-nowrap ${
        large ? "h-8 px-3 text-sm" : "h-6 px-2.5 text-xs"
      }`}
      style={{ color: inkOf(level.color), background: `${level.color}14` }}
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
        <div key={l.key} className="flex h-7 flex-1 items-center justify-center leading-none" style={{ background: `${l.color}1f`, color: inkOf(l.color) }}>
          {t(l.label)}
        </div>
      ))}
    </div>
  );
}

export function TrendArrow({ trend }: { trend: "up" | "down" | "flat" }) {
  const { t } = useI18n();
  if (trend === "flat") return <span className="text-xs text-gray-500">→ {t("유지")}</span>;
  return trend === "up" ? (
    <span className="text-xs font-medium text-red-600">↑ {t("증가")}</span>
  ) : (
    <span className="text-xs font-medium text-emerald-700">↓ {t("감소")}</span>
  );
}
