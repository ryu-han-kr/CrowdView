import Link from "next/link";
import { levelOf } from "@/lib/levels";
import { formatHour } from "@/lib/time";
import type { CrowdResult, Place } from "@/lib/types";
import { LevelMeter, TrendArrow } from "./Level";
import { placeHref } from "@/lib/places";

/** 스와이프 가능한 실시간 트렌드 카드 (CSS scroll-snap) */
export function TrendCarousel({ items }: { items: { place: Place; crowd: CrowdResult }[] }) {
  return (
    <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
      {items.map(({ place, crowd }) => {
        // 운영 전/후엔 오늘 예상 피크를 보여준다
        const peak = crowd.open ? null : [...crowd.hourly].sort((a, b) => b.score - a.score)[0];
        const level = levelOf(peak ? peak.score : crowd.score);
        return (
          <Link
            key={place.id}
            href={placeHref(place)}
            className="relative w-[78%] shrink-0 snap-center overflow-hidden rounded-3xl p-5 text-white active:scale-[0.98] transition-transform"
            style={{
              background: `linear-gradient(140deg, hsl(${place.hue} 70% 45%), hsl(${place.hue + 50} 75% 35%))`,
            }}
          >
            <span className="pointer-events-none absolute -right-3 -bottom-4 text-[88px] opacity-30">{place.emoji}</span>
            <p className="text-xs opacity-80">{place.region}</p>
            <p className="mt-0.5 text-lg font-bold">{place.name}</p>
            <div className="mt-5 flex items-end justify-between">
              <div>
                {peak && <p className="text-xs opacity-85">운영 전 · 오늘 {formatHour(peak.hour)} 피크 예상</p>}
                <p className="text-3xl font-extrabold tracking-tight">{level.label}</p>
                {!peak && <p className="mt-1 text-xs opacity-85">약 {crowd.headcount.toLocaleString()}명</p>}
              </div>
              <div className="flex flex-col items-end gap-1 rounded-xl bg-white/90 px-2 py-1.5">
                <LevelMeter score={peak ? peak.score : crowd.score} />
                {peak ? <span className="text-xs text-gray-500">예측</span> : <TrendArrow trend={crowd.trend} />}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
