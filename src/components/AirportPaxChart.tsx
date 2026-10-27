"use client";

import { useState } from "react";
import type { PaxDay } from "@/lib/airport";
import { useI18n } from "@/i18n/client";
import { fmtPeople, trZone } from "@/i18n/patterns";
import { formatHour, type T } from "@/i18n/translate";
import { scoreFromValue, type LevelSteps } from "@/lib/levels";
import { HourlyChart } from "@/components/charts/lazy";
import type { HourPoint } from "@/lib/types";

const dayLabel = (date: string, today: string, t: T) => {
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  return diff === -1 ? t("어제") : diff === 0 ? t("오늘") : diff === 1 ? t("내일") : date.slice(5);
};

/** 날짜·출국장별 시간대 출발 승객 수. 공항별 시간당 승객 기준(steps)으로 색을 매긴다 */
export function AirportPaxChart({
  days,
  steps,
  today,
  nowHour,
}: {
  days: PaxDay[];
  steps: LevelSteps;
  today: string;
  nowHour: number;
}) {
  const [date, setDate] = useState(days.find((d) => d.date === today)?.date ?? days[0]?.date);
  const { t, lang } = useI18n();
  const [gatePick, setGate] = useState<string>("전체");
  const day = days.find((d) => d.date === date);
  if (!day) return <p className="text-sm text-gray-500">{t("시간대별 승객 정보를 불러오지 못했어요.")}</p>;

  // 그날 승객이 0명인 출국장(운영 안 하는 곳)은 버튼에서 뺀다
  const gateNames = Object.keys(day.hours[0]?.gates ?? {}).filter((g) => day.hours.some((h) => (h.gates?.[g] ?? 0) > 0));
  const gate = gatePick === "전체" || gateNames.includes(gatePick) ? gatePick : "전체";
  const value = (h: PaxDay["hours"][number]) => (gate === "전체" ? h.total : (h.gates?.[gate] ?? 0));
  // 출국장 하나를 볼 때는 공항 기준을 출국장 수로 나눠 색을 매긴다
  const div = gate === "전체" ? 1 : Math.max(1, gateNames.length);
  const gateSteps = steps.map((v) => v / div) as LevelSteps;
  const hours = day.hours.filter((h) => h.hour >= 5);
  const busy = hours.reduce((a, b) => (value(b) > value(a) ? b : a), hours[0]);
  const open = hours.filter((h) => value(h) > 0);
  const calm = open.length ? open.reduce((a, b) => (value(b) < value(a) ? b : a)) : undefined;
  const isToday = date === today;
  // 공항공사 예고치라 전부 '예측'으로, 인원은 공식 예고(real)로 넘긴다
  const points: HourPoint[] = hours.map((h) => ({
    hour: h.hour,
    score: scoreFromValue(value(h), gateSteps),
    forecast: true,
    people: value(h),
    peopleKind: "real",
  }));

  return (
    <div>
      <div className="flex gap-2">
        {days.map((d) => (
          <button
            key={d.date}
            onClick={() => setDate(d.date)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              d.date === date ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {dayLabel(d.date, today, t)}
            <span className="ml-1 text-[11px] opacity-60">{d.date.slice(5).replace("-", "/")}</span>
          </button>
        ))}
      </div>

      {gateNames.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
          {["전체", ...gateNames].map((g) => (
            <button
              key={g}
              onClick={() => setGate(g)}
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs ${
                g === gate ? "border-gray-900 font-semibold text-gray-900" : "border-gray-200 text-gray-500"
              }`}
            >
              {g === "전체" ? t("전체") : trZone(g, t)}
            </button>
          ))}
        </div>
      )}

      {busy && (
        <p className="mt-3 text-sm">
          {t("가장 붐빔")} <b>{formatHour(busy.hour, lang)}</b> ({fmtPeople(value(busy), t, lang)})
          {calm && (
            <>
              {" "}· {t("가장 한산")} <b>{formatHour(calm.hour, lang)}</b> ({fmtPeople(value(calm), t, lang)})
            </>
          )}
        </p>
      )}

      {/* 장소·서울 지역과 같은 시간대 그래프 (경수님 QA #15 10/27: 그래프 모양 통일). 높이는 시간당 승객 기준 혼잡 단계 */}
      <div className="mt-4">
        <HourlyChart
          key={`${date}-${gate}`}
          points={points}
          highlightHour={isToday ? Math.floor(nowHour) : undefined}
          forecastLabel="공항공사 예고"
        />
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        {day.kind === "recorded" ? t("그날 받아 둔 공항공사 예고치") : t("공항공사 시간대별 출발 승객 예고·예상치")} ·{" "}
        {t("그래프 높이·색은 시간당 승객 수 기준 혼잡도")}
      </p>
    </div>
  );
}
