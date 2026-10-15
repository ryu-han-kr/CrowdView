"use client";

import { useFavorites } from "@/lib/prefs";

/** 태블릿·PC용 찜 버튼 (모바일은 상단 고정 바의 하트를 쓴다) */
export function FavoriteButton({ placeId, className = "" }: { placeId: string; className?: string }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(placeId);
  return (
    <button
      onClick={() => toggle(placeId)}
      aria-label={fav ? "찜 해제" : "찜하기"}
      className={`items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 ${className}`}
    >
      {fav ? "❤️ 찜함" : "🤍 찜하기"}
    </button>
  );
}
