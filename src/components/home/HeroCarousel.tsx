"use client";

import Link from "@/i18n/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";

export interface HeroSlide {
  id: string;
  href: string;
  img: string;
  /** 사진 위 작은 꼬리표 (예: 진행 중 축제) */
  tag?: string;
  title: string;
  sub?: string;
}

/** 큰 포토 배너: 5초마다 넘어가고, 태블릿·PC는 양옆 배너가 살짝 보인다 (마우스를 올리면 멈춤) */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((i: number) => {
    const el = ref.current;
    if (!el) return;
    const n = el.children.length;
    const target = el.children[((i % n) + n) % n] as HTMLElement;
    el.scrollTo({ left: target.offsetLeft - (el.clientWidth - target.clientWidth) / 2, behavior: "smooth" });
  }, []);

  // 지금 가운데 있는 배너 번호
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    [...el.children].forEach((c, i) => {
      const h = c as HTMLElement;
      if (Math.abs(h.offsetLeft + h.clientWidth / 2 - mid) < Math.abs((el.children[best] as HTMLElement).offsetLeft + (el.children[best] as HTMLElement).clientWidth / 2 - mid)) best = i;
    });
    setIndex(best);
  };

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const id = setInterval(() => go(index + 1), 5000);
    return () => clearInterval(id);
  }, [index, paused, go, slides.length]);

  if (!slides.length) return null;
  return (
    <section
      className="relative -mx-5 md:mx-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      aria-roledescription="carousel"
    >
      <div ref={ref} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-5 md:gap-4 md:px-[9%]">
        {slides.map((s, i) => (
          <Link
            key={s.id}
            href={s.href}
            aria-label={s.title}
            className="relative block aspect-[16/10] w-full shrink-0 snap-center overflow-hidden rounded-3xl bg-gray-200 md:aspect-[21/8]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.img} alt="" loading={i === 0 ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex max-w-[85%] flex-col justify-end p-5 text-white md:max-w-[60%] md:justify-center md:p-10">
              {s.tag && <span className="mb-2 w-fit rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-gray-900 md:text-xs">{s.tag}</span>}
              <p className="text-xl leading-snug font-extrabold break-keep [text-wrap:balance] md:text-4xl">{s.title}</p>
              {s.sub && <p className="mt-1.5 line-clamp-2 text-xs text-white/85 md:mt-3 md:text-base">{s.sub}</p>}
            </div>
          </Link>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <span className="pointer-events-none absolute right-8 bottom-3 rounded-full bg-black/45 px-2.5 py-0.5 text-[11px] font-semibold text-white md:right-[calc(9%+1rem)] md:bottom-4 md:text-xs">
            {index + 1} / {slides.length}
          </span>
          {(["prev", "next"] as const).map((d) => (
            <button
              key={d}
              onClick={() => go(index + (d === "next" ? 1 : -1))}
              aria-label={t(d === "next" ? "다음" : "이전")}
              className={`absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-900 shadow-md md:flex ${
                d === "prev" ? "left-[calc(9%-1.375rem)]" : "right-[calc(9%-1.375rem)]"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d={d === "next" ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
              </svg>
            </button>
          ))}
        </>
      )}
    </section>
  );
}
