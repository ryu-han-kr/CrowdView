"use client";

import Image from "next/image";
import Link from "@/i18n/link";
import type { CrowdResult, Place } from "@/lib/types";
import { LevelBadge } from "./Level";
import { placeHref } from "@/lib/places";
import { headcountInfo, isEstimated } from "@/lib/format";
import { DataTag } from "./DataTag";
import { useI18n } from "@/i18n/client";
import { Glyph } from "@/components/Glyph";

/** 대표 사진이 있으면 사진, 없으면 색 배경 + 이모지 */
export function PlaceThumb({ place, size = 48 }: { place: Place; size?: number }) {
  const { t } = useI18n();
  if (place.image) {
    return (
      <div className="relative shrink-0 overflow-hidden rounded-2xl bg-gray-100" style={{ width: size, height: size }}>
        <Image src={place.image} alt={t(place.name)} fill sizes={`${size * 2}px`} className="object-cover" />
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
      <Glyph e={place.emoji} className="h-1/2 w-1/2 text-white drop-shadow-sm" />
    </div>
  );
}

export function PlaceRow({ place, crowd }: { place: Place; crowd: CrowdResult }) {
  const i18n = useI18n();
  const { t } = i18n;
  const info = headcountInfo(crowd, i18n);
  return (
    <Link href={placeHref(place)} className="flex items-center gap-3 py-3 active:opacity-70">
      <PlaceThumb place={place} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{t(place.name)}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {t(place.region)}
          {info && (
            <>
              {" · "}
              {info.text}
              {info.kind && <DataTag kind={info.kind} />}
            </>
          )}
          {crowd.open && crowd.trend === "up" && <span className="text-red-500"> · {t("늘어나는 중")}</span>}
          {crowd.open && crowd.trend === "down" && <span className="text-emerald-600"> · {t("줄어드는 중")}</span>}
        </p>
      </div>
      <span className="flex shrink-0 flex-col items-end">
        <LevelBadge score={crowd.score} closed={!crowd.open} offSeason={crowd.offSeason} event={place.category === "event" ? { start: place.eventDate, end: place.eventEndDate } : undefined} />
        {crowd.open && isEstimated(crowd) && <DataTag className="mt-0.5" />}
      </span>
    </Link>
  );
}

/** 태블릿·PC 그리드용 사진 카드 */
export function PlaceCard({ place, crowd }: { place: Place; crowd: CrowdResult }) {
  const i18n = useI18n();
  const { t } = i18n;
  const info = headcountInfo(crowd, i18n);
  return (
    <Link
      href={placeHref(place)}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-md shadow-gray-200/70 ring-1 ring-transparent transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-200/60 hover:ring-indigo-300"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
        {place.image ? (
          <Image
            src={place.image}
            alt={t(place.name)}
            fill
            sizes="(min-width: 1024px) 360px, 50vw"
            className="scale-[1.03] object-cover transition-transform duration-300 group-hover:scale-[1.08]"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-6xl"
            style={{ background: `linear-gradient(135deg, hsl(${place.hue} 80% 88%), hsl(${place.hue + 40} 80% 78%))` }}
          >
            <Glyph e={place.emoji} className="h-16 w-16 text-white drop-shadow-sm" />
          </div>
        )}
        <span className="absolute top-3 left-3 flex rounded-full bg-white/95 shadow-sm">
          <LevelBadge score={crowd.score} closed={!crowd.open} offSeason={crowd.offSeason} event={place.category === "event" ? { start: place.eventDate, end: place.eventEndDate } : undefined} />
        </span>
      </div>
      {/* 카드 높이를 맞추려고 글 영역 높이를 고정 (추세 줄이 없어도 같은 높이) */}
      <div className="h-[92px] p-4">
        <p className="truncate font-semibold">{t(place.name)}</p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {t(place.region)}
          {info && ` · ${info.text}`}
          {info?.kind && <DataTag kind={info.kind} />}
          {crowd.open && isEstimated(crowd) && !info?.kind && <DataTag />}
        </p>
        {crowd.open && crowd.trend !== "flat" && (
          <p className={`mt-1 text-xs ${crowd.trend === "up" ? "text-red-500" : "text-emerald-600"}`}>
            {crowd.trend === "up" ? `↑ ${t("늘어나는 중")}` : `↓ ${t("줄어드는 중")}`}
          </p>
        )}
      </div>
    </Link>
  );
}
