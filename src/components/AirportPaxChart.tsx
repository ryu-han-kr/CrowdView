"use client";

import { useState } from "react";
import type { PaxDay } from "@/lib/airport";
import { levelOf, scoreFromValue, type LevelSteps } from "@/lib/levels";

const dayLabel = (date: string, today: string) => {
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  return diff === -1 ? "어제" : diff === 0 ? "오늘" : diff === 1 ? "내일" : date.slice(5);
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
  const [gate, setGate] = useState<string>("전체");
  const day = days.find((d) => d.date === date);
  if (!day) return <p className="text-sm text-gray-400">시간대별 승객 정보를 불러오지 못했어요.</p>;

  const gateNames = Object.keys(day.hours[0]?.gates ?? {});
  const value = (h: PaxDay["hours"][number]) => (gate === "전체" ? h.total : (h.gates?.[gate] ?? 0));
  // 출국장 하나를 볼 때는 공항 기준을 출국장 수로 나눠 색을 매긴다
  const div = gate === "전체" ? 1 : Math.max(1, gateNames.length);
  const gateSteps = steps.map((v) => v / div) as LevelSteps;
  const hours = day.hours.filter((h) => h.hour >= 5);
  const max = Math.max(1, ...hours.map(value));
  const busy = hours.reduce((a, b) => (value(b) > value(a) ? b : a), hours[0]);
  const open = hours.filter((h) => value(h) > 0);
  const calm = open.length ? open.reduce((a, b) => (value(b) < value(a) ? b : a)) : undefined;
  const isToday = date === today;

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
            {dayLabel(d.date, today)}
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
              {g}
            </button>
          ))}
        </div>
      )}

      {busy && (
        <p className="mt-3 text-sm">
          가장 붐빔 <b>{busy.hour}시</b> ({value(busy).toLocaleString()}명)
          {calm && (
            <>
              {" "}· 가장 한산 <b>{calm.hour}시</b> ({value(calm).toLocaleString()}명)
            </>
          )}
        </p>
      )}

      <div className="mt-4 flex h-36 items-end gap-[3px]">
        {hours.map((h) => {
          const v = value(h);
          const level = levelOf(scoreFromValue(v, gateSteps));
          const now = isToday && h.hour === Math.floor(nowHour);
          return (
            <div key={h.hour} className="relative flex h-full flex-1 flex-col justify-end">
              {now && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-1 text-[9px] font-bold whitespace-nowrap text-white">
                  지금
                </span>
              )}
              <div
                title={`${h.hour}시 · ${v.toLocaleString()}명 · ${level.label}`}
                className={`rounded-t-[4px] ${now ? "ring-2 ring-gray-900 ring-offset-1" : ""}`}
                style={{ height: `${Math.max(3, (v / max) * 100)}%`, background: level.color }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px] text-[10px] text-gray-400">
        {hours.map((h) => (
          <span key={h.hour} className="flex-1 text-center">
            {h.hour % 3 === 0 ? h.hour : ""}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        {day.kind === "recorded" ? "그날 받아 둔 공항공사 예고치" : "공항공사 시간대별 출발 승객 예고·예상치"} · 막대 색은
        시간당 승객 수 기준 혼잡도
      </p>
    </div>
  );
}
