import Image from "next/image";
import Link from "next/link";
import type { CrowdResult, Place } from "@/lib/types";
import { LevelBadge } from "./Level";
import { placeHref } from "@/lib/places";
import { headcountText } from "@/lib/format";

/** 대표 사진이 있으면 사진, 없으면 색 배경 + 이모지 */
export function PlaceThumb({ place, size = 48 }: { place: Place; size?: number }) {
  if (place.image) {
    return (
      <div className="relative shrink-0 overflow-hidden rounded-2xl bg-gray-100" style={{ width: size, height: size }}>
        <Image src={place.image} alt={place.name} fill sizes={`${size * 2}px`} className="object-cover" />
      </div>
    );
  }
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
    <Link href={placeHref(place)} className="flex items-center gap-3 py-3 active:opacity-70">
      <PlaceThumb place={place} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{place.name}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {place.region}
          {headcountText(crowd) && ` · ${headcountText(crowd)}`}
          {crowd.open && crowd.trend === "up" && <span className="text-red-500"> · 늘어나는 중</span>}
          {crowd.open && crowd.trend === "down" && <span className="text-emerald-600"> · 줄어드는 중</span>}
        </p>
      </div>
      <LevelBadge score={crowd.score} closed={!crowd.open} />
    </Link>
  );
}
