"use client";

import Link from "@/i18n/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { canOptimize } from "@/lib/img";
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

const AUTO_MS = 4500; // 자동으로 넘어가는 간격
const RESUME_MS = 8000; // 직접 넘긴 뒤 이만큼 지나면 다시 자동
const SLIDE = { mobile: 100, desktop: 82 }; // 배너 너비 (%). PC는 양옆 배너가 살짝 보인다

/** 큰 포토 배너: 자동으로 넘어가고, 화살표·점·밀어서 넘기기. 끝에서 처음으로 이어진다 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [wide, setWide] = useState(false);
  const holdUntil = useRef(0);
  const touchX = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // 자동 넘김 (직접 넘긴 직후 잠깐 쉬고, 탭이 안 보일 때는 브라우저가 알아서 늦춘다)
  useEffect(() => {
    if (n < 2) return;
    const id = setInterval(() => {
      if (Date.now() < holdUntil.current) return;
      setIndex((i) => (i + 1) % n);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [n]);

  const go = (i: number) => {
    holdUntil.current = Date.now() + RESUME_MS;
    setIndex(((i % n) + n) % n);
  };

  if (!n) return null;
  const w = wide ? SLIDE.desktop : SLIDE.mobile;
  const gap = wide ? 16 : 12;
  // 고른 배너가 가운데 오도록 줄 전체를 옮긴다 (% 는 줄의 너비 = 보이는 영역 너비 기준)
  const shift = `calc(${(100 - w) / 2}% - ${index} * (${w}% + ${gap}px))`;

  return (
    <section
      className="relative -mx-5 overflow-hidden md:mx-0"
      aria-roledescription="carousel"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="flex px-0 transition-transform duration-500 ease-out" style={{ transform: `translateX(${shift})`, gap }}>
        {slides.map((s, i) => (
          <Link
            key={s.id}
            href={s.href}
            aria-label={s.title}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
            className={`relative block aspect-[16/10] shrink-0 overflow-hidden bg-gray-200 transition-opacity duration-500 md:aspect-[21/8] md:rounded-3xl ${
              i === index ? "opacity-100" : "opacity-60"
            }`}
            style={{ width: `${w}%` }}
          >
            <Image
              src={s.img}
              alt=""
              fill
              sizes="(min-width: 768px) 82vw, 100vw"
              priority={i === 0}
              unoptimized={!canOptimize(s.img)}
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex max-w-[85%] flex-col justify-end p-5 pb-9 text-white md:max-w-[60%] md:justify-center md:p-10">
              {s.tag && <span className="mb-2 w-fit rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-gray-900 md:text-xs">{s.tag}</span>}
              <p className="text-xl leading-snug font-extrabold break-keep [text-wrap:balance] md:text-4xl">{s.title}</p>
              {s.sub && <p className="mt-1.5 line-clamp-2 text-xs text-white/85 md:mt-3 md:text-base">{s.sub}</p>}
            </div>
          </Link>
        ))}
      </div>

      {n > 1 && (
        <>
          {/* 아래 점 + 번호 */}
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                aria-label={`${i + 1} / ${n}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/55"}`}
              />
            ))}
          </div>
          <span className="pointer-events-none absolute top-3 right-4 rounded-full bg-black/45 px-2.5 py-0.5 text-[11px] font-semibold text-white md:right-[calc(9%+1rem)] md:text-xs">
            {index + 1} / {n}
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
