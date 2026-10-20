"use client";

import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { useI18n } from "@/i18n/client";

const MALE = "#38bdf8";
const FEMALE = "#f472b6";

/** 성별 비율 도넛 (Bklit Pie) + 가운데 많은 쪽 비율. male·female은 %나 인원 어느 쪽이든 (비율로 계산) */
export function GenderDonut({ male, female, size = 112 }: { male: number; female: number; size?: number }) {
  const { t } = useI18n();
  const total = male + female;
  if (total <= 0) return null;
  const m = Math.round((male / total) * 100);
  const data = [
    { label: t("남성"), value: male, color: MALE },
    { label: t("여성"), value: female, color: FEMALE },
  ];
  const more = m >= 50 ? { label: t("남성"), pct: m, color: MALE } : { label: t("여성"), pct: 100 - m, color: FEMALE };
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${t("남성")} ${m}% · ${t("여성")} ${100 - m}%`}>
        <PieChart data={data} size={size} innerRadius={size * 0.32} padAngle={0.03} cornerRadius={4}>
          {data.map((d, i) => (
            <PieSlice key={d.label} index={i} hoverEffect="none" />
          ))}
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-lg font-extrabold" style={{ color: more.color }}>
            {more.pct}%
          </span>
          <span className="mt-0.5 text-[11px] text-gray-500">{more.label}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: MALE }} />
          {t("남성")} <b>{m}%</b>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: FEMALE }} />
          {t("여성")} <b>{100 - m}%</b>
        </li>
      </ul>
    </div>
  );
}
