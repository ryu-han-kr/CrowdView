import Image from "next/image";
import Link from "next/link";
import type { CrowdResult, Place } from "@/lib/types";
import { LevelBadge } from "./Level";
import { placeHref } from "@/lib/places";
import { headcountInfo, isEstimated } from "@/lib/format";
import { DataTag } from "./DataTag";

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
          {headcountInfo(crowd) && (
            <>
              {" · "}
              {headcountInfo(crowd)!.text}
              {headcountInfo(crowd)!.kind && <DataTag kind={headcountInfo(crowd)!.kind} />}
            </>
          )}
          {crowd.open && crowd.trend === "up" && <span className="text-red-500"> · 늘어나는 중</span>}
          {crowd.open && crowd.trend === "down" && <span className="text-emerald-600"> · 줄어드는 중</span>}
        </p>
      </div>
      <span className="flex shrink-0 flex-col items-end">
        <LevelBadge score={crowd.score} closed={!crowd.open} />
        {crowd.open && isEstimated(crowd) && <DataTag className="mt-0.5" />}
      </span>
    </Link>
  );
}

/** 태블릿·PC 그리드용 사진 카드 */
export function PlaceCard({ place, crowd }: { place: Place; crowd: CrowdResult }) {
  const info = headcountInfo(crowd);
  return (
    <Link
      href={placeHref(place)}
      className="group block overflow-hidden rounded-3xl border border-gray-100 bg-white transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
        {place.image ? (
          <Image
            src={place.image}
            alt={place.name}
            fill
            sizes="(min-width: 1024px) 360px, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-6xl"
            style={{ background: `linear-gradient(135deg, hsl(${place.hue} 80% 88%), hsl(${place.hue + 40} 80% 78%))` }}
          >
            {place.emoji}
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-white/95 shadow-sm">
          <LevelBadge score={crowd.score} closed={!crowd.open} />
        </span>
      </div>
      <div className="p-4">
        <p className="truncate font-semibold">{place.name}</p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {place.region}
          {info && ` · ${info.text}`}
          {info?.kind && <DataTag kind={info.kind} />}
          {crowd.open && isEstimated(crowd) && !info?.kind && <DataTag />}
        </p>
        {crowd.open && crowd.trend !== "flat" && (
          <p className={`mt-1 text-xs ${crowd.trend === "up" ? "text-red-500" : "text-emerald-600"}`}>
            {crowd.trend === "up" ? "↑ 늘어나는 중" : "↓ 줄어드는 중"}
          </p>
        )}
      </div>
    </Link>
  );
}
