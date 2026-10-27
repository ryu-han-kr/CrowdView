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
              <Link href={c.href} className="group block">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gray-800">
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
                  <span
                    className={`absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white ${c.live ? "bg-indigo-600" : "bg-black/60"}`}
                  >
                    {c.live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                    {c.badge}
                  </span>
                  {/* 사진 위엔 지금 단계 알약 하나만 (참고: 여기어때 평점 알약) */}
                  <span className="absolute bottom-2.5 left-2.5 flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.boxColor }} />
                    <span className="truncate text-[13px] font-extrabold" style={{ color: inkOf(c.boxColor) }}>
                      {c.boxValue.replace(/ people/, "")}
                    </span>
                  </span>
                </div>
                {/* 글은 사진 아래 (상자 없이) */}
                <p className="mt-2 truncate text-[12px] font-semibold text-gray-500">{c.boxLine}</p>
                <p className="line-clamp-2 text-[15px] leading-snug font-extrabold break-keep text-gray-950">{c.title}</p>
                <p className="mt-0.5 truncate text-[13px] font-bold text-gray-700">{c.headline}</p>
              </Link>
            </li>
          ))}
        </ul>
        {items.length > 5 && <Arrows onPrev={() => scroll(-1)} onNext={() => scroll(1)} top="top-[36%]" />}
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
  // 배너 레퍼런스(photo/5 BannerExample, 사용자 10/23): 사진 안에 작은 흰 배지 + 큰 흰 제목 + 작은 설명.
  // 휴대폰은 옆으로 넘기는 가로 카드, PC는 3열
  return (
    <section className="mt-10 md:mt-14">
      <SectionHead title={title} sub={sub} />
      <ul className="no-scrollbar -mx-5 mt-3 flex snap-x scroll-px-5 gap-2.5 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:px-0">
        {tiles.map((x) => (
          <li key={x.id} className="w-[78%] shrink-0 snap-start md:w-auto">
            {/* 홈 안의 파트 고르기(?cat=·?q=)는 새로 열어야 목록이 바뀐다 → a */}
            <a href={x.href} className="group relative block aspect-[16/10] overflow-hidden rounded-2xl bg-gray-800">
              {x.img && (
                <Image
                  src={x.img}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 33vw, 80vw"
                  unoptimized={!canOptimize(x.img)}
                  className="object-cover transition-transform duration-300 md:group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-black/0" />
              <div className="absolute inset-y-0 left-0 flex w-[78%] flex-col justify-center px-4 md:px-5">
                <span className="self-start rounded-md bg-white px-1.5 py-0.5 text-[11px] font-extrabold text-gray-900">{x.badge}</span>
                <p className="mt-2 line-clamp-2 text-[20px] leading-tight font-black break-keep text-white drop-shadow md:text-[22px]">{x.title}</p>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug font-medium break-keep text-white/90 drop-shadow">{x.sub}</p>
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
  /** 제목 위 작은 흰 배지 (배너 레퍼런스 photo/5 BannerExample: 배지 + 큰 제목 + 작은 설명이 사진 안에) */
  badge?: string;
  /** 제목 아래 작은 설명 */
  sub?: string;
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
        <div className="relative h-[260px] overflow-hidden rounded-3xl bg-gray-800 md:h-[360px]">
          {c.img && (
            <Image key={c.img} src={c.img} alt="" fill sizes="(min-width: 768px) 70vw, 100vw" unoptimized={!canOptimize(c.img)} className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-black/0" />
          <div className="absolute top-5 right-5 left-5 flex items-start justify-between gap-3 md:top-7 md:left-8 md:right-8">
            <div className="min-w-0">
              {c.badge && <span className="inline-block rounded-md bg-white px-1.5 py-0.5 text-[11px] font-extrabold text-gray-900">{c.badge}</span>}
              <p className="mt-1.5 text-[22px] leading-tight font-black break-keep text-white drop-shadow md:text-[28px]">{c.title}</p>
              {c.sub && <p className="mt-1 text-[12px] font-semibold text-white/90 drop-shadow md:text-sm">{c.sub}</p>}
            </div>
            <Link href={c.href} className="shrink-0 rounded-full bg-white/95 px-3.5 py-1.5 text-[13px] font-bold text-gray-900 shadow">
              {t("자세히 보기")} ›
            </Link>
          </div>
        </div>
        {/* 작은 카드 3장이 큰 사진 아래쪽에 겹쳐 올라온다 */}
        <ul className="relative -mt-24 grid grid-cols-3 gap-2.5 px-3 md:-mt-36 md:gap-5 md:px-8">
          {c.items.map((x) => (
            <li key={x.id}>
              <Link href={x.href} className="group block">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100 shadow-lg ring-[3px] ring-white">
                  {x.img && (
                    <Image
                      src={x.img}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 20vw, 30vw"
                      unoptimized={!canOptimize(x.img)}
                      className="object-cover transition-transform duration-300 md:group-hover:scale-105"
                    />
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] leading-snug font-bold break-keep text-gray-900 md:text-[15px]">{x.title}</p>
                {/* 단계와 인원을 두 줄로 (UI QA 12차: '원활 · 약 3,30…'처럼 인원이 잘렸다) */}
                <p className="mt-0.5 truncate text-[14px] font-extrabold md:text-base" style={{ color: inkOf(x.color) }}>
                  {x.value.split(" · ")[0]}
                </p>
                {x.value.includes(" · ") && <p className="truncate text-[12px] font-bold text-gray-700 md:text-sm">{x.value.split(" · ").slice(1).join(" · ")}</p>}
              </Link>
            </li>
          ))}
        </ul>
        {collections.length > 1 && <Arrows onPrev={() => go(-1)} onNext={() => go(1)} top="top-1/2" />}
      </div>
    </section>
  );
}
