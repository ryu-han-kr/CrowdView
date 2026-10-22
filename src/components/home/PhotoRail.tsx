"use client";

import Link from "@/i18n/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { canOptimize } from "@/lib/img";
import { useI18n } from "@/i18n/client";
import { levelOf } from "@/lib/levels";
import { useFavorites } from "@/lib/prefs";
import { Glyph } from "@/components/Glyph";

export interface PhotoCardItem {
  id: string;
  href: string;
  /** 바깥 사이트(지도 등)면 새 창 */
  external?: boolean;
  img?: string;
  emoji?: string;
  title: string;
  sub?: string;
  /** 사진 왼쪽 위 꼬리표 */
  badge?: string;
  /** 혼잡 점수 (있으면 사진 오른쪽 위에 표시) */
  score?: number;
  /** 사진 위 혼잡 표시 대신 쓸 글 (예: 예상 붐빔 2.1배) */
  note?: string;
  /** 지도로 보기용 위치 */
  lat?: number;
  lng?: number;
  /** 사진 왼쪽 위 분류 꼬리표 (색·3D 아이콘, lib/category-style) */
  tag?: { label: string; color: string; icon: string };
  /** 찜 하트 (우리 장소 id) */
  favId?: string;
  /** 사진 아래 굵게 보일 인원 (예: 약 5,800명) */
  people?: string;
}

/**
 * 세로로 긴 사진 카드 (사용자 QA 10/22, 레퍼런스: 여기어때 '이런 상품은 어떠세요?' 카드).
 * 사진 위: 왼쪽 위 분류 꼬리표(색·아이콘) · 오른쪽 위 찜 하트 · 아래 어둡게 깔고 흰 굵은 글씨로 지금 단계·인원
 * 사진 아래: 이름(굵게) · 지역
 */
export function PhotoCard({ item, rank, className = "" }: { item: PhotoCardItem; rank?: number; className?: string }) {
  const { t } = useI18n();
  const { isFavorite, toggle } = useFavorites();
  const lv = item.score !== undefined ? levelOf(item.score) : undefined;
  const fav = item.favId ? isFavorite(item.favId) : false;
  const bottom = lv || item.badge || item.note;
  const body = (
    <>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-gray-100">
        {item.img ? (
          <Image
            src={item.img}
            alt=""
            fill
            sizes="(min-width: 768px) 20vw, 45vw"
            unoptimized={!canOptimize(item.img)}
            className="object-cover transition-transform duration-300 md:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-400">
            <Glyph e={item.emoji ?? "📍"} className="h-12 w-12" />
          </div>
        )}
        {item.tag && (
          <span
            className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/95 py-0.5 pr-2.5 pl-1 text-[12px] font-extrabold shadow-sm"
            style={{ color: item.tag.color }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 작은 고정 아이콘 */}
            <img src={`/icons/3d/${item.tag.icon}.webp`} alt="" width={18} height={18} className="h-[18px] w-[18px]" />
            {item.tag.label}
          </span>
        )}
        {item.favId && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(item.favId!);
            }}
            aria-label={fav ? t("즐겨찾기 해제") : t("즐겨찾기")}
            aria-pressed={fav}
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm transition active:scale-90"
          >
            <Glyph e={fav ? "❤️" : "🤍"} className={`h-[18px] w-[18px] ${fav ? "text-rose-500" : "text-white"}`} />
          </button>
        )}
        {(bottom || rank !== undefined) && (
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        )}
        {rank !== undefined && (
          <span className="absolute bottom-1 left-3 text-5xl leading-none font-black text-white italic drop-shadow md:text-6xl">{rank}</span>
        )}
        {bottom && (
          <p className={`absolute right-2.5 bottom-2 left-2.5 truncate text-white drop-shadow ${rank !== undefined ? "pl-10 text-right" : ""}`}>
            {lv ? (
              <>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/80" style={{ background: lv.color }} />
                <b className="text-[17px] font-extrabold">{t(lv.label)}</b>
                {item.people && <span className="ml-1 text-[13px] font-bold">{item.people}</span>}
              </>
            ) : (
              <b className="text-[15px] font-extrabold">{item.badge ?? item.note}</b>
            )}
          </p>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[15px] leading-snug font-bold break-keep text-gray-950">{item.title}</p>
      {item.sub && <p className="mt-0.5 truncate text-[13px] font-medium text-gray-600">{item.sub}</p>}
      {item.note && lv && <p className="mt-0.5 truncate text-[13px] font-bold text-rose-600">{item.note}</p>}
    </>
  );
  const cls = `group block ${className}`;
  return item.external ? (
    <a href={item.href} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={item.href} className={cls}>
      {body}
    </Link>
  );
}

/** 제목 + 칩(선택) + 가로로 넘기는 사진 카드 줄. 태블릿·PC는 양옆 화살표 */
export function PhotoRail({
  title,
  subtitle,
  moreHref,
  items,
  ranked = false,
  chips,
}: {
  title: string;
  subtitle?: string;
  moreHref?: string;
  items: PhotoCardItem[];
  ranked?: boolean;
  /** 칩을 고르면 그 칩의 카드만 */
  chips?: { id: string; label: string; items: PhotoCardItem[] }[];
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLUListElement>(null);
  const [chip, setChip] = useState(chips?.[0]?.id);
  const shown = chips ? (chips.find((c) => c.id === chip)?.items ?? []) : items;
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  if (!shown.length && !chips) return null;

  return (
    <section className="mt-10 md:mt-14">
      <div className="flex items-end justify-between gap-3">
        <h2 className="min-w-0 text-xl font-extrabold tracking-tight md:text-2xl">
          {title}
          {subtitle && <span className="ml-2 hidden text-sm font-medium text-gray-600 md:inline">{subtitle}</span>}
        </h2>
        {moreHref && (
          <Link href={moreHref} className="shrink-0 text-sm font-semibold text-gray-700">
            {t("전체 보기")} ›
          </Link>
        )}
      </div>
      {subtitle && <p className="mt-0.5 text-[13px] font-medium text-gray-600 md:hidden">{subtitle}</p>}
      {chips && (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setChip(c.id);
                ref.current?.scrollTo({ left: 0 });
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${chip === c.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="relative mt-3">
        {/* scroll-px: 스냅 기준을 좌우 여백(px-5)과 맞춘다. 안 맞으면 처음 열 때 브라우저가 목록을 20px 스냅 이동시키고,
            크롬은 그걸 사용자 스크롤로 보고 홈의 LCP(가장 큰 요소 표시 시간) 측정을 멈췄다 (Lighthouse NO_LCP) */}
        <ul
          ref={ref}
          className="no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto scroll-smooth px-5 md:mx-0 md:scroll-px-0 md:gap-4 md:px-0"
        >
          {shown.map((it, i) => (
            <li key={it.id} className="w-[42%] shrink-0 snap-start sm:w-[30%] md:w-[calc((100%-4rem)/5)]">
              <PhotoCard item={it} rank={ranked ? i + 1 : undefined} />
            </li>
          ))}
        </ul>
        {shown.length > 5 &&
          ([-1, 1] as const).map((d) => (
            <button
              key={d}
              onClick={() => scroll(d)}
              aria-label={t(d > 0 ? "다음" : "이전")}
              className={`absolute top-[38%] hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-100 bg-white shadow-md md:flex ${
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
      </div>
    </section>
  );
}
