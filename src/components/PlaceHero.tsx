"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { canOptimize } from "@/lib/img";
import { useI18n } from "@/i18n/client";
import { imageCreditText } from "@/lib/places";
import { useFavorites } from "@/lib/prefs";
import type { Place } from "@/lib/types";

const HERO_HEIGHT = 280;

/**
 * 상단 이미지 영역 + 스크롤에 따라 축소/페이드되는 패럴랙스, 스크롤 후 나타나는 상단 바.
 * gallery: 관광공사 사진 여러 장 — 밀거나 화살표로 넘겨 본다 (첫 장은 대표 사진)
 */
export function PlaceHero({ place, gallery = [] }: { place: Place; gallery?: string[] }) {
  const router = useRouter();
  const { isFavorite, toggle } = useFavorites();
  const { t, lp } = useI18n();
  const [y, setY] = useState(0);

  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const photos = [...(place.image ? [place.image] : []), ...gallery];
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  const go = (i: number) => setIdx(((i % photos.length) + photos.length) % photos.length);
  const progress = Math.min(1, y / (HERO_HEIGHT - 64));
  const fav = isFavorite(place.id);

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-30 mx-auto flex h-14 max-w-md items-center justify-between px-3 transition-colors md:hidden"
        style={{
          background: `rgb(255 255 255 / ${progress})`,
          boxShadow: progress >= 1 ? "0 1px 0 #f3f4f6" : "none",
        }}
      >
        <button
          onClick={() => (history.length > 1 ? router.back() : router.push(lp("/")))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-lg backdrop-blur"
          aria-label={t("뒤로")}
        >
          ←
        </button>
        <span className="font-semibold" style={{ opacity: progress >= 1 ? 1 : 0, transition: "opacity .2s" }}>
          {t(place.name)}
        </span>
        <button
          onClick={() => toggle(place.id)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-lg backdrop-blur"
          aria-label={fav ? t("즐겨찾기 해제") : t("즐겨찾기")}
        >
          {fav ? "❤️" : "🤍"}
        </button>
      </div>

      <div
        className="relative flex items-center justify-center overflow-hidden md:mt-6 md:h-[380px]! md:rounded-3xl"
        style={{
          height: HERO_HEIGHT,
          background: `linear-gradient(160deg, hsl(${place.hue} 75% 70%), hsl(${place.hue + 50} 70% 45%))`,
        }}
      >
        {photos.length ? (
          <>
            <div
              className="absolute inset-0 flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${idx * 100}%)` }}
              onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                touchX.current = null;
                if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
              }}
            >
              {photos.map((src, i) => (
                <div key={src} className="relative h-full w-full shrink-0 overflow-hidden">
                  <Image
                    src={src}
                    alt={i === 0 ? t(place.name) : ""}
                    fill
                    priority={i === 0}
                    loading={i === 0 ? undefined : "lazy"}
                    sizes="(min-width: 768px) 1100px, 100vw"
                    unoptimized={!canOptimize(src)}
                    className="object-cover will-change-transform"
                    style={i === 0 ? { transform: `translateY(${y * 0.3}px) scale(${1 + progress * 0.08})` } : undefined}
                  />
                </div>
              ))}
            </div>
            {/* 상단 버튼이 사진 위에서도 보이도록 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent" />
            <span className="absolute right-3 bottom-8 rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-white/90">
              {idx === 0 ? imageCreditText(place, t) : t("사진 한국관광공사")}
            </span>
            {photos.length > 1 && (
              <>
                <span className="absolute top-16 right-4 rounded-full bg-black/45 px-2.5 py-0.5 text-[11px] font-semibold text-white md:top-4">
                  {idx + 1} / {photos.length}
                </span>
                {(["prev", "next"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => go(idx + (d === "next" ? 1 : -1))}
                    aria-label={t(d === "next" ? "다음" : "이전")}
                    className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow md:flex ${
                      d === "prev" ? "left-4" : "right-4"
                    }`}
                  >
                    {d === "next" ? "›" : "‹"}
                  </button>
                ))}
              </>
            )}
          </>
        ) : (
          <span
            className="text-[120px] drop-shadow-xl will-change-transform"
            style={{
              transform: `translateY(${y * 0.4}px) scale(${1 - progress * 0.25})`,
              opacity: 1 - progress * 0.8,
            }}
          >
            {place.emoji}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
      </div>
    </>
  );
}
