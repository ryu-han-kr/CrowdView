"use client";

import { Glyph } from "@/components/Glyph";
import { useI18n } from "@/i18n/client";
import { mapUrl } from "@/lib/geo";

/**
 * 사진 위 지도 단추 (경수님 QA 11/1: 카드에서 바로 지도로). 한국어 화면의 국내 장소는 카카오맵, 그 밖에는 구글 지도.
 * 카드 전체가 링크라 그 안에 또 링크를 둘 수 없어 단추로 연다
 */
export function MapLinkButton({ name, lat, lng, className = "" }: { name: string; lat: number; lng: number; className?: string }) {
  const { t, lang } = useI18n();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(mapUrl(name, lat, lng, lang), "_blank", "noopener");
      }}
      aria-label={t("지도에서 보기")}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition active:scale-90 ${className}`}
    >
      <Glyph e="📍" className="h-[18px] w-[18px] text-white" />
    </button>
  );
}
