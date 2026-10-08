"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFavorites } from "@/lib/prefs";
import type { Place } from "@/lib/types";

const HERO_HEIGHT = 280;

/** 상단 이미지 영역 + 스크롤에 따라 축소/페이드되는 패럴랙스, 스크롤 후 나타나는 상단 바 */
export function PlaceHero({ place }: { place: Place }) {
  const router = useRouter();
  const { isFavorite, toggle } = useFavorites();
  const [y, setY] = useState(0);

  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const progress = Math.min(1, y / (HERO_HEIGHT - 64));
  const fav = isFavorite(place.id);

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-30 mx-auto flex h-14 max-w-md items-center justify-between px-3 transition-colors"
        style={{
          background: `rgb(255 255 255 / ${progress})`,
          boxShadow: progress >= 1 ? "0 1px 0 #f3f4f6" : "none",
        }}
      >
        <button
          onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-lg backdrop-blur"
          aria-label="뒤로"
        >
          ←
        </button>
        <span className="font-semibold" style={{ opacity: progress >= 1 ? 1 : 0, transition: "opacity .2s" }}>
          {place.name}
        </span>
        <button
          onClick={() => toggle(place.id)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-lg backdrop-blur"
          aria-label={fav ? "즐겨찾기 해제" : "즐겨찾기"}
        >
          {fav ? "❤️" : "🤍"}
        </button>
      </div>

      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          height: HERO_HEIGHT,
          background: `linear-gradient(160deg, hsl(${place.hue} 75% 70%), hsl(${place.hue + 50} 70% 45%))`,
        }}
      >
        <span
          className="text-[120px] drop-shadow-xl will-change-transform"
          style={{
            transform: `translateY(${y * 0.4}px) scale(${1 - progress * 0.25})`,
            opacity: 1 - progress * 0.8,
          }}
        >
          {place.emoji}
        </span>
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
      </div>
    </>
  );
}
