"use client";

// 원형 사진 칩 줄 (경수님 레퍼런스 10/27: 여행 사이트의 나라 고르기 — 동그란 사진 + 아래 이름, 고른 것은 어둡게 + 체크).
// 사진이 없으면 이모지를 연한 바탕 원에. PC에서는 오른쪽 화살표로 한 화면씩 민다
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Glyph } from "@/components/Glyph";
import { canOptimize } from "@/lib/img";

export interface RoundChip {
  id: string;
  label: string;
  img?: string;
  emoji?: string;
}

export function RoundChips({
  items,
  value,
  onChange,
  className = "",
  size = "md",
}: {
  items: RoundChip[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** md: 56px(PC 64px), lg: 64px(PC 72px) */
  size?: "md" | "lg";
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  // 오른쪽에 더 있을 때만 화살표
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, [items.length]);
  const circle = size === "lg" ? "h-16 w-16 md:h-[72px] md:w-[72px]" : "h-14 w-14 md:h-16 md:w-16";
  return (
    <div className={`relative ${className}`}>
      <div ref={scroller} className="no-scrollbar flex gap-1 overflow-x-auto px-1 pt-1 pb-1 md:gap-2">
        {items.map((c) => {
          const on = c.id === value;
          return (
            <button
              key={c.id}
              aria-pressed={on}
              onClick={() => onChange(c.id)}
              className="group flex w-[72px] shrink-0 flex-col items-center gap-1.5 md:w-[84px]"
            >
              <span
                className={`relative block overflow-hidden rounded-full bg-indigo-50 ring-offset-2 transition-[box-shadow,transform] ${circle} ${
                  on ? "ring-2 ring-indigo-600" : "ring-1 ring-gray-200 md:group-hover:-translate-y-0.5"
                }`}
              >
                {c.img ? (
                  <Image src={c.img} alt="" fill sizes="72px" unoptimized={!canOptimize(c.img)} className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-indigo-600">
                    <Glyph e={c.emoji ?? "✨"} className="h-7 w-7" />
                  </span>
                )}
                {on && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                  </span>
                )}
              </span>
              <span className={`line-clamp-2 w-full text-center text-[13px] leading-tight font-semibold break-keep ${on ? "text-indigo-600" : "text-gray-800"}`}>
                {c.label}
              </span>
            </button>
          );
        })}
      </div>
      {more && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => scroller.current?.scrollBy({ left: scroller.current.clientWidth * 0.8, behavior: "smooth" })}
          className="absolute top-1/2 right-0 hidden h-9 w-9 -translate-y-[calc(50%+10px)] items-center justify-center rounded-full bg-white text-gray-700 shadow-md ring-1 ring-gray-200 md:flex"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
