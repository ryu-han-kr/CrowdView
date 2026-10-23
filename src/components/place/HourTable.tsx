"use client";

import { useI18n } from "@/i18n/client";
import { levelOf, tintInkOf } from "@/lib/levels";

/**
 * 오늘 시간별 표 ('더 보기' 창, 사용자 10/23: 크고 더 자세한 정보). 운영 시간 안의 시간마다 단계·예상 값·실측/예측
 */
export function HourTable({ rows, nowHour }: { rows: { hour: number; label: string; score: number; value?: string; forecast: boolean }[]; nowHour: number }) {
  const { t } = useI18n();
  return (
    <div className="mt-6">
      <p className="mb-2 text-base font-extrabold">{t("시간별 자세히")}</p>
      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
        {rows.map((r) => {
          const l = levelOf(r.score);
          const now = r.hour === nowHour;
          return (
            <li key={r.hour} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${now ? "bg-gray-50" : ""}`}>
              <span className="w-14 shrink-0 font-bold text-gray-900">
                {r.label}
                {now && <span className="ml-1 text-[11px] font-bold text-indigo-600">{t("지금")}</span>}
              </span>
              <span className="rounded-full px-2.5 py-0.5 text-[13px] font-extrabold" style={{ background: `${l.color}2b`, color: tintInkOf(l.color) }}>
                {t(l.label)}
              </span>
              {r.value && <span className="font-semibold text-gray-800">{r.value}</span>}
              <span className="ml-auto text-xs text-gray-500">{r.forecast ? t("AI 예측") : t("실측")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
