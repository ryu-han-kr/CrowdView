"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "@/i18n/link";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PhotoGrid, PhotoViewer, type ViewerPhoto } from "@/components/place/PhotoViewer";
import { useI18n } from "@/i18n/client";
import { canOptimize } from "@/lib/img";
import { photoCreditText } from "@/lib/place-href";
import { useFavorites } from "@/lib/prefs";
import type { Place } from "@/lib/types";
import { Glyph } from "@/components/Glyph";

const HERO_HEIGHT = 300;

export interface HeroChip {
  label: string;
  href?: string;
}

/**
 * 장소 상단 사진 (사용자 QA 10/22, 레퍼런스: 여기어때 숙소 상세).
 * - 휴대폰: 밀어 넘기는 사진 + 스크롤하면 나타나는 상단 바, 사진 위에 분류 칩
 * - PC: 큰 사진 1장 + 작은 사진 4장 격자, 마지막 칸에 '사진 N+' — 누르면 전체 보기(썸네일 줄)
 * - 찜(하트)은 사진 위 아이콘으로 바로
 * photos를 주면 그것(출처 포함), 아니면 대표 사진 + gallery 주소들
 */
export function PlaceHero({
  place,
  gallery = [],
  photos: given,
  chips = [],
  favorite = true,
}: {
  place: Place;
  gallery?: string[];
  photos?: ViewerPhoto[];
  chips?: HeroChip[];
  favorite?: boolean;
}) {
  const router = useRouter();
  const { isFavorite, toggle } = useFavorites();
  const { t, lp } = useI18n();
  const [y, setY] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [grid, setGrid] = useState(false);

  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const photos: ViewerPhoto[] =
    given && given.length
      ? given
      : [...new Set([...(place.image ? [place.image] : []), ...gallery])].map((src) => ({ src, credit: photoCreditText(src, place, t) }));
  const progress = Math.min(1, y / (HERO_HEIGHT - 64));
  const fav = isFavorite(place.id);
  const name = t(place.name);

  const heart = (cls: string) =>
    favorite ? (
      <button
        onClick={() => toggle(place.id)}
        className={`flex items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition active:scale-90 ${cls}`}
        aria-label={fav ? t("즐겨찾기 해제") : t("즐겨찾기")}
        aria-pressed={fav}
      >
        <Glyph e={fav ? "❤️" : "🤍"} className={`h-5 w-5 ${fav ? "text-rose-500" : "text-gray-800"}`} />
      </button>
    ) : null;

  const chipRow = (cls: string) =>
    chips.length > 0 && (
      <div className={`flex flex-wrap gap-1.5 ${cls}`}>
        {chips.map((c) =>
          c.href ? (
            <Link
              key={c.label}
              href={c.href}
              className="rounded-full bg-black/55 px-3 py-1 text-[13px] font-bold text-white backdrop-blur-sm transition hover:bg-black/70"
            >
              {c.label} ›
            </Link>
          ) : (
            <span key={c.label} className="rounded-full bg-black/45 px-3 py-1 text-[13px] font-bold text-white backdrop-blur-sm">
              {c.label}
            </span>
          ),
        )}
      </div>
    );

  return (
    <>
      {/* 휴대폰 상단 바: 스크롤하면 흰 바탕 + 제목 */}
      <div
        className="fixed inset-x-0 top-0 z-30 mx-auto flex h-14 max-w-md items-center justify-between px-3 transition-colors md:hidden"
        // 바탕은 화면 면 색(--surface)을 스크롤만큼 (UI QA 13차: 다크 모드에서 흰 바에 흰 제목이라 안 보였다)
        style={{
          background: `color-mix(in srgb, var(--surface, #fff) ${Math.round(progress * 100)}%, transparent)`,
          boxShadow: progress >= 1 ? "0 1px 0 var(--color-gray-200)" : "none",
        }}
      >
        <button
          onClick={() => (history.length > 1 ? router.back() : router.push(lp("/")))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow-sm backdrop-blur"
          aria-label={t("뒤로")}
        >
          ←
        </button>
        <span className="font-bold" style={{ opacity: progress >= 1 ? 1 : 0, transition: "opacity .2s" }}>
          {name}
        </span>
        {heart("h-9 w-9") ?? <span className="h-9 w-9" />}
      </div>

      {/* 휴대폰: 넘겨 보는 사진 */}
      <div
        className="relative overflow-hidden md:hidden"
        style={{ height: HERO_HEIGHT, background: `linear-gradient(160deg, hsl(${place.hue} 70% 62%), hsl(${place.hue + 50} 65% 40%))` }}
      >
        {photos.length ? (
          <>
            <PhotoGallery
              photos={photos.map((p) => p.src)}
              alt={name}
              className="absolute inset-0"
              credits={photos.map((p) => p.credit)}
              imageStyle={{ transform: `translateY(${y * 0.3}px) scale(${1 + progress * 0.08})` }}
              counterClassName="top-16 right-4"
              bottomClassName="bottom-3"
              onSelect={(i) => setViewer(i)}
              kenBurns
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent" />
            {chipRow("absolute bottom-11 left-4 z-10")}
            {photos.length > 1 && (
              <button
                onClick={() => setGrid(true)}
                className="absolute right-4 bottom-11 z-10 flex items-center gap-1 rounded-full bg-black/55 px-3 py-1 text-[13px] font-bold text-white backdrop-blur-sm"
              >
                <Glyph e="🖼️" className="h-3.5 w-3.5" /> {t("전체 사진")} {photos.length}
              </button>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Glyph e={place.emoji} className="h-28 w-28 text-white drop-shadow" />
            {chipRow("absolute bottom-4 left-4")}
          </div>
        )}
      </div>

      {/* PC: 큰 사진 + 2×2 */}
      <div className="hidden md:mt-6 md:block">
        {photos.length ? (
          <div
            className={`grid h-[440px] gap-2 overflow-hidden rounded-3xl ${photos.length >= 5 ? "grid-cols-4 grid-rows-2" : photos.length >= 3 ? "grid-cols-3 grid-rows-2" : "grid-cols-1"}`}
          >
            {photos.slice(0, photos.length >= 5 ? 5 : photos.length >= 3 ? 3 : 1).map((p, i, shown) => (
              <div key={p.src} className={`group relative overflow-hidden bg-gray-100 ${i === 0 && shown.length > 1 ? "col-span-2 row-span-2" : ""}`}>
                <div className={`kenburns ${i % 2 ? "kb-alt" : ""}`} style={i ? { animationDelay: `${i * 0.7}s` } : undefined}>
                  <Image
                    src={p.src}
                    alt={p.alt ?? name}
                    fill
                    sizes={i === 0 ? "(min-width: 1280px) 640px, 50vw" : "320px"}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    unoptimized={!canOptimize(p.src)}
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <button
                  onClick={() => (i === shown.length - 1 && photos.length > shown.length ? setGrid(true) : setViewer(i))}
                  className="absolute inset-0 cursor-zoom-in"
                  aria-label={`${name} ${t("사진")} ${i + 1}/${photos.length}`}
                />
                {i === 0 && (
                  <>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/50 to-transparent" />
                    {chipRow("absolute bottom-4 left-4")}
                    {heart("absolute top-4 right-4 h-11 w-11")}
                    <span className="pointer-events-none absolute right-4 bottom-4 max-w-[45%] truncate rounded bg-black/45 px-1.5 py-0.5 text-[11px] text-white/90">
                      {p.credit}
                    </span>
                  </>
                )}
                {i === shown.length - 1 && photos.length > shown.length && (
                  <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/75 px-3.5 py-1.5 text-sm font-bold text-white">
                    <Glyph e="🖼️" className="h-4 w-4" /> {photos.length - shown.length}+
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex h-[320px] items-center justify-center rounded-3xl"
            style={{ background: `linear-gradient(160deg, hsl(${place.hue} 70% 62%), hsl(${place.hue + 50} 65% 40%))` }}
          >
            <Glyph e={place.emoji} className="h-28 w-28 text-white drop-shadow" />
          </div>
        )}
      </div>

      <PhotoGrid
        photos={photos}
        open={grid}
        onOpenChange={setGrid}
        onPick={(i) => {
          setGrid(false);
          setViewer(i);
        }}
        title={name}
      />
      <PhotoViewer
        photos={photos}
        open={viewer !== null}
        index={viewer ?? 0}
        onIndex={setViewer}
        onOpenChange={(o) => !o && setViewer(null)}
        title={name}
      />
    </>
  );
}
