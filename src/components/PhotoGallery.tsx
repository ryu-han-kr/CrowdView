"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { canOptimize } from "@/lib/img";
import { cn } from "@/lib/cn";

/**
 * 사진 여러 장을 배너처럼 옆으로 밀어 넘겨 본다 (휴대폰은 손가락을 따라 움직이는 스크롤 스냅, PC는 화살표).
 * 위에 몇 번째 사진인지, 아래에 점 표시. credits: 사진마다 출처 문구 (photos와 같은 순서)
 */
export function PhotoGallery({
  photos,
  alt,
  credits,
  className = "",
  imageStyle,
  sizes = "(min-width: 768px) 1100px, 100vw",
  counterClassName = "top-3 right-3",
  bottomClassName = "bottom-3",
}: {
  photos: string[];
  alt: string;
  credits: string[];
  className?: string;
  /** 첫 장에만 주는 스타일 (상세 위 사진의 스크롤 효과) */
  imageStyle?: React.CSSProperties;
  sizes?: string;
  counterClassName?: string;
  /** 아래 점·출처 줄의 위치 (사진 아래를 다른 내용이 덮으면 올린다) */
  bottomClassName?: string;
}) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = (i + photos.length) % photos.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        ref={track}
        className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        aria-roledescription={t("사진 넘겨 보기")}
      >
        {photos.map((src, i) => (
          <div key={src} className="relative h-full w-full shrink-0 snap-center overflow-hidden" aria-label={`${i + 1} / ${photos.length}`}>
            <Image
              src={src}
              alt={i === 0 ? alt : `${alt} ${i + 1}`}
              fill
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              sizes={sizes}
              unoptimized={!canOptimize(src)}
              className="object-cover"
              style={i === 0 ? imageStyle : undefined}
            />
          </div>
        ))}
      </div>

      <div className={`pointer-events-none absolute inset-x-3 flex items-center justify-between gap-2 ${bottomClassName}`}>
        {/* 점: 너무 많으면 고른 사진 앞뒤 몇 개만 */}
        <div className="flex gap-1.5 rounded-full bg-black/30 px-2 py-1.5" style={{ visibility: photos.length > 1 ? "visible" : "hidden" }}>
          {photos.map((src, i) =>
            Math.abs(i - idx) <= 3 ? (
              <span key={src} className={`h-1.5 rounded-full bg-white transition-all ${i === idx ? "w-5" : "w-1.5 opacity-60"}`} />
            ) : null,
          )}
        </div>
        <span className="truncate rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-white/95">{credits[Math.min(idx, photos.length - 1)]}</span>
      </div>
      {photos.length > 1 && (
        <>
          <span className={`pointer-events-none absolute rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white ${counterClassName}`}>
            {idx + 1} / {photos.length}
          </span>
          {(["prev", "next"] as const).map((d) => (
            <button
              key={d}
              onClick={() => go(idx + (d === "next" ? 1 : -1))}
              aria-label={t(d === "next" ? "다음" : "이전")}
              className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-gray-900 shadow md:flex ${
                d === "prev" ? "left-4" : "right-4"
              }`}
            >
              {d === "next" ? "›" : "‹"}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
