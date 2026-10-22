"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import Link from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import { canOptimize } from "@/lib/img";
import { inkOf } from "@/lib/levels";

// 홈 모음 섹션 3가지 (사용자 레퍼런스 10/22, photo/qa-ref/round3): 세로 실시간 카드 줄 · 테마 타일 · 지역 모음 배너

/** 좌우 화살표 (태블릿·PC) */
function Arrows({ onPrev, onNext, top = "top-[42%]" }: { onPrev: () => void; onNext: () => void; top?: string }) {
  const { t } = useI18n();
  return (
    <>
      {([-1, 1] as const).map((d) => (
        <button
          key={d}
          onClick={d < 0 ? onPrev : onNext}
          aria-label={t(d > 0 ? "다음" : "이전")}
          className={`absolute ${top} z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-100 bg-white shadow-md md:flex ${
            d < 0 ? "-left-5" : "-right-5"
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
            <path d={d > 0 ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
          </svg>
        </button>
      ))}
    </>
  );
}

function SectionHead({ title, sub, moreHref }: { title: string; sub?: string; moreHref?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] font-medium text-gray-600 md:text-sm">{sub}</p>}
      </div>
      {moreHref && (
        <Link href={moreHref} className="shrink-0 text-sm font-semibold text-gray-700">
          {t("전체 보기")} ›
        </Link>
      )}
    </div>
  );
}

// ── 1) 세로 실시간 카드 줄 (레퍼런스: NOL 숏폼 카드)
export interface ShortCard {
  id: string;
  href: string;
  img?: string;
  /** 왼쪽 위 꼬리표 (LIVE·예측) */
  badge: string;
  live: boolean;
  /** 사진 가운데 큰 흰 글씨 (예: 평균 대기 31분 / 지금 원활) */
  headline: string;
  title: string;
  /** 아래 흰 상자: 작은 줄 + 굵은 색 값 */
  boxLine: string;
  boxValue: string;
  boxColor: string;
}

export function ShortCardRail({ title, sub, moreHref, items }: { title: string; sub?: string; moreHref?: string; items: ShortCard[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  if (!items.length) return null;
  return (
    <section className="mt-10 md:mt-14">
      <SectionHead title={title} sub={sub} moreHref={moreHref} />
      <div className="relative mt-3">
        <ul ref={ref} className="no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 md:mx-0 md:scroll-px-0 md:gap-4 md:px-0">
          {items.map((c) => (
            <li key={c.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-[calc((100%-4rem)/5)]">
              <Link href={c.href} className="group relative block aspect-[9/14] overflow-hidden rounded-2xl bg-gray-800">
                {c.img && (
                  <Image
                    src={c.img}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 20vw, 45vw"
                    unoptimized={!canOptimize(c.img)}
                    className="object-cover transition-transform duration-300 md:group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/75" />
                <span
                  className={`absolute top-2.5 left-2.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold text-white ${c.live ? "bg-red-600" : "bg-black/60"}`}
                >
                  {c.live && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  {c.badge}
                </span>
                <div className="absolute inset-x-3 top-[34%] text-center">
                  <p className="text-[22px] leading-tight font-black break-keep text-white drop-shadow md:text-2xl">{c.headline}</p>
                </div>
                <p className="absolute inset-x-3 bottom-[68px] line-clamp-2 text-[14px] leading-snug font-bold break-keep text-white drop-shadow">
                  {c.title}
                </p>
                <div className="absolute inset-x-2 bottom-2 rounded-xl bg-white px-2.5 py-2">
                  <p className="truncate text-[12px] font-medium text-gray-700">{c.boxLine}</p>
                  <p className="truncate text-[15px] font-extrabold" style={{ color: inkOf(c.boxColor) }}>
                    {c.boxValue}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {items.length > 5 && <Arrows onPrev={() => scroll(-1)} onNext={() => scroll(1)} />}
      </div>
    </section>
  );
}

// ── 2) 테마 타일 (레퍼런스: NOL 기획전 타일)
export interface ThemeTile {
  id: string;
  href: string;
  img?: string;
  badge: string;
  title: string;
  sub: string;
}

export function ThemeTiles({ title, sub, tiles }: { title: string; sub?: string; tiles: ThemeTile[] }) {
  return (
    <section className="mt-10 md:mt-14">
      <SectionHead title={title} sub={sub} />
      <ul className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3">
        {tiles.map((x) => (
          <li key={x.id}>
            {/* 홈 안의 파트 고르기(?cat=·?q=)는 새로 열어야 목록이 바뀐다 → a */}
            <a href={x.href} className="group relative block aspect-square overflow-hidden rounded-2xl bg-gray-800 md:aspect-[5/4]">
              {x.img && (
                <Image
                  src={x.img}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 33vw, 50vw"
                  unoptimized={!canOptimize(x.img)}
                  className="object-cover transition-transform duration-300 md:group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
              <span className="absolute top-2.5 left-2.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-extrabold text-gray-900">
                {x.badge}
              </span>
              <div className="absolute inset-x-3 bottom-3 md:inset-x-4 md:bottom-4">
                <p className="text-[18px] leading-tight font-black break-keep text-white drop-shadow md:text-[22px]">{x.title}</p>
                <p className="mt-1 line-clamp-2 text-[12px] font-semibold text-white/90 md:text-sm">{x.sub}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 3) 지역 모음 배너 (레퍼런스: 트립닷컴 '이시가키지마 인기 숙소 모음')
export interface Collection {
  id: string;
  title: string;
  href: string;
  img?: string;
  items: { id: string; href: string; img?: string; title: string; value: string; color: string }[];
}

export function CollectionCarousel({ title, sub, collections }: { title: string; sub?: string; collections: Collection[] }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  if (!collections.length) return null;
  const c = collections[i];
  const go = (d: number) => setI((i + d + collections.length) % collections.length);
  return (
    <section className="mt-10 md:mt-14">
      <SectionHead title={title} sub={sub} />
      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
        {collections.map((x, j) => (
          <button
            key={x.id}
            onClick={() => setI(j)}
            aria-pressed={j === i}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold ${j === i ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            {x.id}
          </button>
        ))}
      </div>
      <div className="relative mt-3">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white md:grid md:grid-cols-[1fr_1.35fr]">
          <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[300px]">
            {c.img && (
              <Image
                key={c.img}
                src={c.img}
                alt=""
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                unoptimized={!canOptimize(c.img)}
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/40" />
            <p className="absolute top-5 right-5 left-5 text-[22px] leading-tight font-black break-keep text-white drop-shadow md:top-8 md:left-8 md:text-[28px]">
              {c.title}
            </p>
            <Link
              href={c.href}
              className="absolute bottom-4 left-5 rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-900 shadow md:bottom-8 md:left-8"
            >
              {t("자세히 보기")} ›
            </Link>
          </div>
          <ul className="grid grid-cols-3 gap-2.5 p-3 md:gap-4 md:p-6">
            {c.items.map((x) => (
              <li key={x.id}>
                <Link href={x.href} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-100">
                    {x.img && (
                      <Image
                        src={x.img}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 15vw, 30vw"
                        unoptimized={!canOptimize(x.img)}
                        className="object-cover transition-transform duration-300 md:group-hover:scale-105"
                      />
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-[13px] font-semibold text-gray-800 md:text-sm">{x.title}</p>
                  <p className="truncate text-[15px] font-extrabold md:text-base" style={{ color: inkOf(x.color) }}>
                    {x.value}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {collections.length > 1 && <Arrows onPrev={() => go(-1)} onNext={() => go(1)} top="top-1/2" />}
      </div>
    </section>
  );
}
