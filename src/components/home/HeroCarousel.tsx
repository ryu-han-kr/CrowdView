"use client";

import Link from "@/i18n/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { canOptimize } from "@/lib/img";
import { useI18n } from "@/i18n/client";
import { usePlus } from "@/lib/plus-client";

export interface HeroSlide {
  id: string;
  href: string;
  img: string;
  /** 사진 위 작은 꼬리표 (예: 진행 중 축제) */
  tag?: string;
  /** 실측 자료가 들어오는 화면이면 빨간 LIVE 표시 (NOL 레퍼런스) */
  live?: boolean;
  title: string;
  sub?: string;
}

const AUTO_MS = 3500; // 자동으로 넘어가는 간격
const RESUME_MS = 8000; // 직접 넘긴 뒤 이만큼 지나면 다시 자동
const SLIDE_MS = 450; // 한 장 넘어가는 시간

/**
 * 큰 포토 배너: 가운데 한 장 + 양옆 배너가 살짝 보인다. 자동으로 넘어가고, 화살표·점·밀어서 넘기기.
 * 목록을 3벌 이어 붙여 가운데 벌을 보여 주고, 끝을 넘어가면 애니메이션 없이 가운데 벌의 같은 배너로 되돌린다 (끝없이 이어지게)
 */
export function HeroCarousel({ slides: all }: { slides: HeroSlide[] }) {
  const { t } = useI18n();
  // Plus 회원에게는 Plus 홍보 배너를 빼고 보여 준다
  const plus = usePlus();
  const slides = plus ? all.filter((s) => s.id !== "plus") : all;
  const n = slides.length;
  const loop = n > 1;
  const [pos, setPos] = useState(loop ? n : 0); // 3벌 중 위치 (가운데 벌: n ~ 2n-1)
  const [animate, setAnimate] = useState(true);
  // 일시정지 (오른쪽 아래 ⏸ 버튼). 켜 두면 자동으로 넘어가지 않는다
  const [paused, setPaused] = useState(false);
  const holdUntil = useRef(0);
  const touchX = useRef<number | null>(null);
  const index = loop ? (((pos - n) % n) + n) % n : 0;

  // 자동 넘김 (직접 넘긴 직후 잠깐 쉬고, 탭이 안 보일 때는 브라우저가 알아서 늦춘다)
  useEffect(() => {
    if (!loop || paused) return;
    const id = setInterval(() => {
      if (Date.now() < holdUntil.current) return;
      setAnimate(true);
      setPos((p) => p + 1);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [loop, paused]);

  // 가운데 벌을 벗어나면 넘김이 끝난 뒤 같은 배너 자리로 순간 이동
  useEffect(() => {
    if (!loop || (pos >= n && pos < 2 * n)) return;
    const id = setTimeout(() => {
      setAnimate(false);
      setPos(n + ((((pos - n) % n) + n) % n));
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [pos, n, loop]);
  // 순간 이동한 다음 그림부터 다시 애니메이션
  useEffect(() => {
    if (animate) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  const step = (d: number) => {
    holdUntil.current = Date.now() + RESUME_MS;
    setAnimate(true);
    setPos((p) => p + d);
  };
  const goTo = (i: number) => step(i - index);

  if (!n) return null;
  const items = loop ? [...slides, ...slides, ...slides] : slides;

  return (
    <section
      // 배너 폭 --w: 휴대폰 84%, PC 82%. 양옆 남는 자리에 이전·다음 배너가 보인다
      className="relative -mx-5 overflow-hidden [--gap:8px] [--w:84cqw] [container-type:inline-size] md:mx-0 md:[--gap:16px] md:[--w:82cqw]"
      aria-roledescription="carousel"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      }}
    >
      <div
        className="flex gap-[var(--gap)] ease-out"
        style={{
          transform: `translateX(calc((100cqw - var(--w)) / 2 - ${pos} * (var(--w) + var(--gap))))`,
          transitionProperty: "transform",
          transitionDuration: animate ? `${SLIDE_MS}ms` : "0ms",
        }}
      >
        {items.map((s, k) => {
          const current = k === pos;
          // 처음 화면에 가운데 보이는 배너 (가장 큰 그림 → 먼저 받기). 무한 넘김용 복제본도 같은 그림이라 같이 (LCP 경고: 복제본이 lazy였다)
          const main = s.id === items[loop ? n : 0].id;
          const near = Math.abs(k - pos) <= 1;
          return (
            <Link
              key={`${s.id}-${k}`}
              href={s.href}
              aria-hidden={!current}
              tabIndex={current ? 0 : -1}
              className={`relative block aspect-[16/10] w-[var(--w)] shrink-0 overflow-hidden rounded-2xl bg-gray-200 transition-opacity duration-300 md:aspect-[21/9] md:rounded-3xl ${
                current ? "" : "opacity-60"
              }`}
            >
              <Image
                src={s.img}
                alt=""
                fill
                sizes="(min-width: 768px) 900px, 84vw"
                loading={main || near ? "eager" : "lazy"}
                fetchPriority={main ? "high" : "auto"}
                unoptimized={!canOptimize(s.img)}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
              <div className="absolute inset-y-0 left-0 flex max-w-[85%] flex-col justify-end p-5 pb-9 text-white md:max-w-[60%] md:justify-center md:px-16 md:py-10">
                {(s.tag || s.live) && (
                  <span className="mb-2 flex w-fit items-stretch overflow-hidden rounded-md text-[11px] font-bold md:text-xs">
                    {/* 옆에 흐리게 보이는 배너(opacity 60%)에서는 빨간 바탕 글자 대비가 모자라 가운데 배너에만 */}
                    {s.live && current && <span className="bg-red-700 px-2 py-0.5 text-white">LIVE</span>}
                    {s.tag && <span className={`px-2 py-0.5 ${s.live ? "bg-black/60 text-white" : "bg-white text-gray-900"}`}>{s.tag}</span>}
                  </span>
                )}
                <p className="text-xl leading-snug font-extrabold break-keep [text-wrap:balance] md:text-4xl">{s.title}</p>
                {s.sub && <p className="mt-1.5 line-clamp-2 text-xs text-white/85 md:mt-3 md:text-base">{s.sub}</p>}
              </div>
            </Link>
          );
        })}
      </div>

      {n > 1 && (
        <>
          {/* 아래 점 (왼쪽) + 일시정지·번호 알약 (오른쪽, NOL 레퍼런스) */}
          <div className="absolute bottom-3 left-[calc((100cqw-var(--w))/2+16px)] flex items-center gap-1.5 md:bottom-4 md:left-[calc((100cqw-var(--w))/2+24px)]">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                aria-label={`${i + 1} / ${n}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/55"}`}
              />
            ))}
          </div>
          <div className="absolute right-[calc((100cqw-var(--w))/2+12px)] bottom-2.5 flex items-center gap-1 md:right-[calc((100cqw-var(--w))/2+16px)] md:bottom-3">
            <button
              onClick={() => setPaused((p) => !p)}
              aria-label={t(paused ? "자동 넘김 재생" : "자동 넘김 멈춤")}
              aria-pressed={paused}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                {paused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h3v14H7zM14 5h3v14h-3z" />}
              </svg>
            </button>
            <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white md:text-xs">
              {index + 1} / {n}
            </span>
          </div>
          {(["prev", "next"] as const).map((d) => (
            <button
              key={d}
              onClick={() => step(d === "next" ? 1 : -1)}
              aria-label={t(d === "next" ? "다음" : "이전")}
              className={`absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md md:flex ${
                d === "prev" ? "left-[calc((100cqw-var(--w))/2-22px)]" : "right-[calc((100cqw-var(--w))/2-22px)]"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={d === "next" ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
              </svg>
            </button>
          ))}
        </>
      )}
    </section>
  );
}
