"use client";

import { useEffect, useState } from "react";
import { Character } from "@/components/Character";
import { useI18n } from "@/i18n/client";
import { krDayById, type KrDay } from "@/lib/kr-days";

/**
 * 기념일 날 홈 머리 아래 인사 띠 (경수님 10/28: 설·추석·삼일절·어린이날·광복절·한글날·크리스마스·새해).
 * 날짜는 서버가 고르고(lib/kr-days), 미리 보기는 주소 뒤 ?day=christmas 처럼.
 * 장소·관광지 상세에는 떨어지는 효과 없이 기념일 날 이 띠만 (경수님 10/28)
 */
/** 태극기 (윈도우 크롬은 국기 이모지를 'KR' 글자로 보여 줘서 직접 그린다) */
function Taegeukgi({ className = "" }: { className?: string }) {
  const bar = (x: number, y: number, rot: number, cuts: boolean[]) => (
    <g transform={`rotate(${rot} ${x} ${y}) translate(${x - 6} ${y - 5})`} fill="#111">
      {cuts.map((cut, i) =>
        cut ? (
          <g key={i}>
            <rect y={i * 3.6} width="5.4" height="2.4" />
            <rect x="6.6" y={i * 3.6} width="5.4" height="2.4" />
          </g>
        ) : (
          <rect key={i} y={i * 3.6} width="12" height="2.4" />
        ),
      )}
    </g>
  );
  return (
    <svg viewBox="0 0 72 48" className={className} aria-hidden>
      <rect width="72" height="48" rx="3" fill="#fff" stroke="#e5e7eb" />
      <g transform="rotate(33.7 36 24)">
        <circle cx="36" cy="24" r="12" fill="#0047a0" />
        <path d="M24 24a12 12 0 0 1 24 0a6 6 0 0 1-12 0a6 6 0 0 0-12 0z" fill="#cd2e3a" />
      </g>
      {bar(15, 12, -56.3, [false, false, false])}
      {bar(57, 36, -56.3, [true, true, true])}
      {bar(57, 12, 56.3, [true, false, true])}
      {bar(15, 36, 56.3, [false, true, false])}
    </svg>
  );
}

const pic = (e: string, cls: string) => (e === "🇰🇷" ? <Taegeukgi className={cls} /> : e);

export function HolidayRibbon({ day: given, className = "mb-4 md:mb-6" }: { day?: KrDay; className?: string }) {
  const { t } = useI18n();
  const [day, setDay] = useState(given);
  useEffect(() => {
    const forced = new URLSearchParams(location.search).get("day");
    if (forced) setDay(krDayById(forced) ?? given);
  }, [given]);
  if (!day) return null;
  return (
    <section
      className={`relative flex items-center gap-3 overflow-hidden rounded-3xl px-4 py-3 md:px-6 ${className}`}
      style={{ background: `linear-gradient(110deg, ${day.bg[0]}, ${day.bg[1]})` }}
      data-day={day.id}
    >
      <span aria-hidden className="holiday-emoji shrink-0 text-3xl font-black text-emerald-700 md:text-4xl">
        {pic(day.emoji, "h-8 w-12 md:h-10 md:w-14")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] leading-snug font-extrabold text-gray-900 md:text-lg">{t(day.msg)}</p>
        <p className="mt-0.5 truncate text-xs text-gray-600 md:text-sm">{t(day.sub)}</p>
      </div>
      {/* 캐릭터 머리 위에 그날의 꾸밈 */}
      <span aria-hidden className="relative -my-3 shrink-0">
        <Character name={day.character} pose="pick" size={72} className="mascot-bob" />
        <span className="holiday-deco absolute top-2 right-0 text-xl">{pic(day.deco, "h-4 w-6")}</span>
      </span>
    </section>
  );
}
