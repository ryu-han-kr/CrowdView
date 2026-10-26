"use client";

import { useState } from "react";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { useI18n } from "@/i18n/client";

// 사용자 10/26: 하늘·분홍 조합이 튀어서 사이트 차트 색(인디고 계열)으로 통일
const MALE = "#4f46e5";
const FEMALE = "#c084fc";

/**
 * 성별 비율 도넛 (Bklit Pie) + 가운데 많은 쪽 비율. male·female은 %나 인원 어느 쪽이든 (비율로 계산)
 * 사용자 10/26: 조각에 마우스를 올리거나 누르면 그 조각이 바깥으로 자라고 가운데 글자가 그 조각 값으로 바뀐다. 범례에 올려도 같은 조각이 반응
 */
export function GenderDonut({ male, female, size = 112 }: { male: number; female: number; size?: number }) {
  const { t } = useI18n();
  const [hov, setHov] = useState<number | null>(null);
  const total = male + female;
  if (total <= 0) return null;
  const m = Math.round((male / total) * 100);
  const data = [
    { label: t("남성"), value: male, color: MALE, pct: m },
    { label: t("여성"), value: female, color: FEMALE, pct: 100 - m },
  ];
  const more = m >= 50 ? data[0] : data[1];
  const shown = hov === null ? more : data[hov];
  return (
    <div className="flex items-center gap-4" onPointerLeave={() => setHov(null)}>
      <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${t("남성")} ${m}% · ${t("여성")} ${100 - m}%`}>
        <PieChart data={data} size={size} innerRadius={size * 0.32} padAngle={0.03} cornerRadius={4} hoverOffset={7} hoveredIndex={hov} onHoverChange={setHov}>
          {data.map((d, i) => (
            <PieSlice key={d.label} index={i} hoverEffect="grow" showGlow={false} />
          ))}
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-lg font-extrabold transition-colors" style={{ color: shown.color }}>
            {shown.pct}%
          </span>
          <span className="mt-0.5 text-[11px] text-gray-500">{shown.label}</span>
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => (
          <li
            key={d.label}
            className={`flex cursor-default items-center gap-2 rounded-lg px-2 py-0.5 transition-colors ${hov === i ? "bg-gray-100" : ""}`}
            onPointerEnter={() => setHov(i)}
            onPointerDown={() => setHov(hov === i ? null : i)}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            {d.label} <b>{d.pct}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
