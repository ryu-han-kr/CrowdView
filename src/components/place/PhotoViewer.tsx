"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { useI18n } from "@/i18n/client";
import { canOptimize } from "@/lib/img";

export interface ViewerPhoto {
  src: string;
  credit: string;
  alt?: string;
  /** 원본(라이선스) 페이지 — 커먼즈 사진은 저작자·라이선스와 함께 링크 */
  href?: string;
}

/**
 * 사진 전체 보기 (레퍼런스: 트립닷컴 게시물 사진 — 큰 사진 + 아래 썸네일 줄, 지금 사진은 파란 테두리).
 * 화살표·키보드 ←→·썸네일 누르기로 넘긴다. 휴대폰은 전체 화면
 */
export function PhotoViewer({
  photos,
  open,
  index,
  onIndex,
  onOpenChange,
  title,
}: {
  photos: ViewerPhoto[];
  open: boolean;
  index: number;
  onIndex: (i: number) => void;
  onOpenChange: (open: boolean) => void;
  title: string;
}) {
  const { t } = useI18n();
  const strip = useRef<HTMLDivElement>(null);
  const n = photos.length;
  const go = (d: number) => onIndex((index + d + n) % n);
  const p = photos[Math.min(index, n - 1)];

  // 지금 사진의 썸네일이 보이게
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index, open]);

  if (!n) return null;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col text-white outline-none md:inset-6 md:rounded-3xl md:bg-neutral-900"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
          }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <DialogPrimitive.Title className="min-w-0 truncate text-base font-bold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{t("사진 넘겨 보기")}</DialogPrimitive.Description>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-white/80">
              {index + 1} / {n}
            </span>
            <DialogPrimitive.Close
              aria-label={t("닫기")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl leading-none hover:bg-white/20"
            >
              ×
            </DialogPrimitive.Close>
          </div>

          <div className="relative min-h-0 flex-1">
            <Image
              key={p.src}
              src={p.src}
              alt={p.alt ?? `${title} ${index + 1}/${n}`}
              fill
              sizes="(min-width: 768px) 1200px, 100vw"
              unoptimized={!canOptimize(p.src)}
              className="object-contain"
            />
            {n > 1 &&
              (["prev", "next"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => go(d === "next" ? 1 : -1)}
                  aria-label={t(d === "next" ? "다음" : "이전")}
                  className={`absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-black/55 text-3xl text-white hover:bg-black/75 ${
                    d === "prev" ? "left-2 md:left-4" : "right-2 md:right-4"
                  }`}
                >
                  {d === "next" ? "›" : "‹"}
                </button>
              ))}
            {p.href ? (
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-3 bottom-3 max-w-[80%] truncate rounded bg-black/55 px-2 py-0.5 text-[11px] text-white/90 underline-offset-2 hover:underline"
              >
                {p.credit}
              </a>
            ) : (
              <span className="absolute right-3 bottom-3 max-w-[80%] truncate rounded bg-black/55 px-2 py-0.5 text-[11px] text-white/90">{p.credit}</span>
            )}
          </div>

          {n > 1 && (
            <div ref={strip} className="no-scrollbar flex gap-2 overflow-x-auto bg-neutral-800/80 px-4 py-3 md:justify-center md:rounded-b-3xl">
              {photos.map((ph, i) => (
                <button
                  key={ph.src}
                  data-i={i}
                  onClick={() => onIndex(i)}
                  aria-label={`${i + 1} / ${n}`}
                  aria-current={i === index}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-md ring-offset-2 ring-offset-neutral-800 md:h-20 md:w-28 ${
                    i === index ? "ring-3 ring-blue-500" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image src={ph.src} alt="" fill sizes="112px" unoptimized={!canOptimize(ph.src)} className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
