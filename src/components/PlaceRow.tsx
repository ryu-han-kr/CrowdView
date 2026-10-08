import Link from "next/link";
import type { CrowdResult, Place } from "@/lib/types";
import { LevelBadge, LevelMeter, TrendArrow } from "./Level";

export function PlaceThumb({ place, size = 48 }: { place: Place; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `linear-gradient(135deg, hsl(${place.hue} 80% 88%), hsl(${place.hue + 40} 80% 78%))`,
      }}
    >
      {place.emoji}
    </div>
  );
}

export function PlaceRow({ place, crowd }: { place: Place; crowd: CrowdResult }) {
  return (
    <Link href={`/place/${place.id}`} className="flex items-center gap-3 py-3 active:opacity-70">
      <PlaceThumb place={place} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{place.name}</p>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {place.region}
          {crowd.open && ` · 약 ${crowd.headcount.toLocaleString()}명`}
        </p>
      </div>
      {crowd.open ? (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <LevelBadge score={crowd.score} />
            <LevelMeter score={crowd.score} />
          </div>
          <TrendArrow trend={crowd.trend} />
        </div>
      ) : (
        <LevelBadge score={crowd.score} closed />
      )}
    </Link>
  );
}
