"use client";

import { LiveBadge } from "@/components/LiveBadge";
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
const AUTO_MS_PC = 5000; // PC 배너(겹쳐 바뀜)는 조금 느리게 (경수님 10/31)
const FADE_MS = 1200; // PC 배너가 겹쳐 바뀌는 시간 (700 → 1200: 경수님 10/31 '좀 부드럽게')
const RESUME_MS = 8000; // 직접 넘긴 뒤 이만큼 지나면 다시 자동
const SLIDE_MS = 450; // 한 장 넘어가는 시간

/**
 * 큰 포토 배너: 휴대폰은 가운데 한 장 + 양옆 배너가 살짝, PC는 두 장 나란히 (QA #8 PC 레퍼런스 10/27). 자동으로 넘어가고, 화살표·점·밀어서 넘기기.
 * 목록을 3벌 이어 붙여 가운데 벌을 보여 주고, 끝을 넘어가면 애니메이션 없이 가운데 벌의 같은 배너로 되돌린다 (끝없이 이어지게)
 */
export function HeroCarousel({
  slides: all,
  layout = "peek",
  eager = true,
}: {
  slides: HeroSlide[];
  /** peek: 휴대폰 가운데 한 장 + 양옆 살짝, PC 두 장 나란히 / single: 칸 폭 그대로 한 장씩 (PC 홈 배너 두 개, 경수님 10/27) */
  layout?: "peek" | "single";
  /** 첫 배너 사진을 바로 받을지. 화면에 숨겨진(display:none) 배너는 false로 두어 받지 않게 한다 */
  eager?: boolean;
}) {
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
  // 시계의 AUTO_MS 눈금에 맞춰 시작해, 나란히 놓인 PC 배너 두 개가 같은 순간에 넘어가게 한다 (경수님 10/28)
  const autoMs = layout === "single" ? AUTO_MS_PC : AUTO_MS;
  useEffect(() => {
    if (!loop || paused) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      if (Date.now() < holdUntil.current) return;
      setAnimate(true);
      setPos((p) => p + 1);
    };
    // 다음 눈금이 너무 가까우면(첫 화면 직후) 한 눈금 더 기다린다
    let wait = autoMs - (Date.now() % autoMs);
    if (wait < autoMs / 2) wait += autoMs;
    const start = setTimeout(() => {
      tick();
      id = setInterval(tick, autoMs);
    }, wait);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [loop, paused, autoMs]);

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
  // single(PC 홈 배너 두 개): 옆으로 밀면 오른쪽 배너 그림이 왼쪽으로 넘어가는 한 줄처럼 보여서(경수님 10/28) 제자리에서 겹쳐 바뀐다
  const fade = layout === "single";
  const items = loop && !fade ? [...slides, ...slides, ...slides] : slides;

  return (
    <section
      // 배너 폭 --w: 휴대폰 84%(양옆에 이전·다음 배너가 살짝), PC는 절반씩 두 장. --off: 현재 배너의 왼쪽 위치
      className={
        layout === "single"
          ? "relative overflow-hidden rounded-3xl [--gap:0px] [--off:0px] [--w:100cqw] [container-type:inline-size]"
          : "relative -mx-5 overflow-hidden [--gap:8px] [--off:calc((100cqw-var(--w))/2)] [--w:84cqw] [container-type:inline-size] md:mx-0 md:[--gap:16px] md:[--off:0px] md:[--w:calc((100cqw-var(--gap))/2)]"
      }
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
        className={fade ? "grid" : "flex gap-[var(--gap)] ease-out"}
        style={
          fade
            ? undefined
            : {
                transform: `translateX(calc(var(--off) - ${pos} * (var(--w) + var(--gap))))`,
                transitionProperty: "transform",
                transitionDuration: animate ? `${SLIDE_MS}ms` : "0ms",
              }
        }
      >
        {items.map((s, k) => {
          const current = fade ? k === index : k === pos;
          // PC에서 오른쪽에 함께 보이는 두 번째 배너 (휴대폰에선 옆에 흐리게 보이는 배너)
          const second = layout === "peek" && loop && k === pos + 1;
          // 처음 화면에 가운데 보이는 배너 (가장 큰 그림 → 먼저 받기). 무한 넘김용 복제본도 같은 그림이라 같이 (LCP 경고: 복제본이 lazy였다)
          const main = s.id === items[loop && !fade ? n : 0].id;
          // 겹쳐 바뀌는 배너는 지금·다음·이전 장만 그림을 받는다 (6장이 한 자리에 겹쳐 있어 모두 화면 안으로 잡힌다)
          // 밀어 넘기는 배너(휴대폰)도 지금 장 앞뒤 2장만 그림을 넣는다 — 12장을 3벌 복제해 36장의 사진 주소(srcset)가 HTML에 다 실려 50KB였다 (10/31 라이트하우스)
          const near = fade ? current || k === (index + 1) % n || k === (index + n - 1) % n : Math.abs(k - pos) <= 2;
          return (
            <Link
              key={`${s.id}-${k}`}
              href={s.href}
              style={fade ? { transitionDuration: `${FADE_MS}ms` } : undefined}
              aria-hidden={!current}
              tabIndex={current ? 0 : -1}
              className={
                fade
                  ? `relative block aspect-[16/10] w-full overflow-hidden rounded-[28px] bg-gray-200 transition-opacity ease-in-out [grid-area:1/1] md:aspect-[16/9] md:rounded-3xl ${current ? "z-[1] opacity-100" : "pointer-events-none opacity-0"}`
                  : `relative block aspect-[16/10] w-[var(--w)] shrink-0 overflow-hidden rounded-[28px] bg-gray-200 transition-opacity duration-300 md:aspect-[16/9] md:rounded-3xl ${
                      current ? "" : second ? "opacity-60 md:opacity-100" : "opacity-60"
                    }`
              }
            >
              {near && (
                <Image
                  src={s.img}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 560px, 84vw"
                  // 현재 장만 즉시 (10/26 성능: 양옆 2장까지 즉시 받던 것을 넘길 때로)
                  loading={main && eager ? "eager" : "lazy"}
                  fetchPriority={main && eager ? "high" : "auto"}
                  unoptimized={!canOptimize(s.img)}
                  // PC 겹쳐 바뀌는 배너: 들어오는 사진이 아주 살짝 당겨지듯 커졌다 제자리로 (부드럽게, 10/31)
                  className={`object-cover ${fade ? `transition-transform duration-[6000ms] ease-out ${current ? "scale-100" : "scale-[1.06]"}` : ""}`}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
              <div className="absolute inset-y-0 left-0 flex max-w-[85%] flex-col justify-end p-5 pb-9 text-white md:max-w-[80%] md:justify-end md:px-8 md:pb-12">
                {(s.tag || s.live) && (
                  <span className="mb-2 flex w-fit items-stretch overflow-hidden rounded-md text-[11px] font-bold md:text-xs">
                    {/* 옆에 흐리게 보이는 배너(opacity 60%)에서는 빨간 바탕 글자 대비가 모자라 가운데 배너에만 */}
                    {s.live && current && <LiveBadge shape="flat" />}
                    {s.live && second && (
                      <span className="hidden md:flex">
                        <LiveBadge shape="flat" />
                      </span>
                    )}
                    {/* 영어에선 '실시간' 꼬리표도 'LIVE'라 두 번 나왔다 → 같으면 생략 */}
                    {s.tag && !(s.live && s.tag.toUpperCase() === "LIVE") && (
                      <span className={`px-2 py-0.5 ${s.live ? "bg-black/60 text-white" : "bg-white text-gray-900"}`}>{s.tag}</span>
                    )}
                  </span>
                )}
                <p className="text-xl leading-snug font-extrabold break-keep [text-wrap:balance] md:text-2xl lg:text-3xl">{s.title}</p>
                {s.sub && <p className="mt-1.5 line-clamp-2 text-xs text-white/85 md:mt-2 md:text-sm lg:text-base">{s.sub}</p>}
              </div>
            </Link>
          );
        })}
      </div>

      {n > 1 && (
        <>
          {/* 아래 점 (왼쪽) + 일시정지·번호 알약 (오른쪽, NOL 레퍼런스) */}
          {/* 점은 작게 보이되 누르는 칸은 24px (Lighthouse target-size: 6px 버튼은 누르기 어렵다) */}
          {/* z-[2]: 겹쳐 바뀌는 PC 배너는 지금 장이 z-[1]이라 점·버튼이 그 밑에 깔려 안 보였다 (경수님 10/31 '지나간 것도 점으로 고르게') */}
          <div className="absolute bottom-0.5 left-[calc(var(--off)+10px)] z-[2] flex items-center md:bottom-1.5 md:left-[calc(var(--off)+18px)]">
            {slides.map((s, i) => (
              <button key={s.id} onClick={() => goTo(i)} aria-label={`${i + 1} / ${n}`} className="flex h-6 min-w-6 items-center justify-center">
                <span className={`block h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/55"}`} />
              </button>
            ))}
          </div>
          {/* 휴대폰은 오른쪽 위로: 배너가 12장이면 아래 점 줄이 이 알약 밑으로 들어가 마지막 점을 누를 수 없었다 (10/31 라이트하우스 target-size) */}
          <div className="absolute top-2.5 right-[calc(var(--off)+12px)] z-[2] flex items-center gap-1 md:top-auto md:right-4 md:bottom-3">
            {/* PC 넘기기 화살표: 배너 가운데에 두면 제목 글자를 가려서 번호 알약 옆으로 (QA #8, 10/27) */}
            {(["prev", "next"] as const).map((d) => (
              <button
                key={d}
                onClick={() => step(d === "next" ? 1 : -1)}
                aria-label={t(d === "next" ? "다음" : "이전")}
                className="hidden h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white md:flex"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
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
        </>
      )}
    </section>
  );
}
