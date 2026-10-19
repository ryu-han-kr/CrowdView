"use client";

import { useI18n } from "@/i18n/client";
import { useFavorites } from "@/lib/prefs";
import { Glyph } from "@/components/Glyph";

/** 태블릿·PC용 찜 버튼 (모바일은 상단 고정 바의 하트를 쓴다) */
export function FavoriteButton({ placeId, className = "" }: { placeId: string; className?: string }) {
  const { t } = useI18n();
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(placeId);
  return (
    <button
      onClick={() => toggle(placeId)}
      aria-label={fav ? t("찜 해제") : t("찜하기")}
      className={`items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 ${className}`}
    >
      <Glyph e={fav ? "❤️" : "🤍"} className={`h-4 w-4 ${fav ? "text-rose-500" : ""}`} /> {fav ? t("찜함") : t("찜하기")}
    </button>
  );
}
