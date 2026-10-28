"use client";

import { useEffect, useState } from "react";
import { Character } from "@/components/Character";
import { useI18n } from "@/i18n/client";
import { krDayById, type KrDay } from "@/lib/kr-days";

/**
 * 기념일 날 홈 머리 아래 인사 띠 (경수님 10/28: 설·추석·삼일절·어린이날·광복절·한글날·크리스마스·새해).
 * 날짜는 서버가 고르고(lib/kr-days), 미리 보기는 주소 뒤 ?day=christmas 처럼
 */
export function HolidayRibbon({ day: given }: { day?: KrDay }) {
  const { t } = useI18n();
  const [day, setDay] = useState(given);
  useEffect(() => {
    const forced = new URLSearchParams(location.search).get("day");
    if (forced) setDay(krDayById(forced) ?? given);
  }, [given]);
  if (!day) return null;
  return (
    <section
      className="relative mb-4 flex items-center gap-3 overflow-hidden rounded-3xl px-4 py-3 md:mb-6 md:px-6"
      style={{ background: `linear-gradient(110deg, ${day.bg[0]}, ${day.bg[1]})` }}
      data-day={day.id}
    >
      <span aria-hidden className="holiday-emoji shrink-0 text-3xl font-black text-emerald-700 md:text-4xl">
        {day.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] leading-snug font-extrabold text-gray-900 md:text-lg">{t(day.msg)}</p>
        <p className="mt-0.5 truncate text-xs text-gray-600 md:text-sm">{t(day.sub)}</p>
      </div>
      {/* 캐릭터 머리 위에 그날의 꾸밈 */}
      <span aria-hidden className="relative -my-3 shrink-0">
        <Character name={day.character} pose="pick" size={72} className="mascot-bob" />
        <span className="holiday-deco absolute -top-1 right-0 text-xl">{day.deco}</span>
      </span>
    </section>
  );
}
