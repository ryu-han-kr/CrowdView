"use client";

import Link from "@/i18n/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { canOptimize } from "@/lib/img";
import { useI18n } from "@/i18n/client";
import { inkOf, levelOf } from "@/lib/levels";
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
 * 사진 위: 왼쪽 위 분류 꼬리표(색·아이콘) · 오른쪽 위 찜 하트 · 아래 흰 알약에 지금 단계·인원
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
        {item.tag && <TagLabel label={item.tag.label} className="absolute top-2 left-2" />}
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
        {/* 아래: 순위 배지 + 흰 단계 알약 (UI QA 9차: 큰 기울임 숫자·그림자 글씨가 포스터 글자와 겹쳐 어지러웠다) */}
        {(bottom || rank !== undefined) && (
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
            {rank !== undefined && (
              <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-gray-950 px-1.5 text-[17px] leading-none font-black text-white shadow-sm">
                {rank}
              </span>
            )}
            {bottom && (
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-sm">
                {lv ? (
                  <>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: lv.color }} />
                    <b className="shrink-0 text-[13px] font-extrabold" style={{ color: inkOf(lv.color) }}>
                      {t(lv.label)}
                    </b>
                    {item.people && <span className="truncate text-[12px] font-bold text-gray-800">{shortPeople(item.people)}</span>}
                  </>
                ) : (
                  <b className="truncate text-[13px] font-extrabold text-gray-900">{item.badge ?? item.note}</b>
                )}
              </span>
            )}
          </div>
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

/**
 * 사진 위 분류 이름 (아쿠아리움·놀이공원 등). 작은 반투명 글자로 두어, 아래 흰 혼잡 알약(원활 약 1,040명)이 먼저 읽히게 한다
 * (사용자 10/23: 분류 칩과 혼잡 알약이 같은 크기라 무엇이 중요한지 안 보였다)
 */
export function TagLabel({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span className={`rounded-md bg-black/40 px-1.5 py-0.5 text-[11px] leading-4 font-semibold text-white backdrop-blur-sm ${className}`}>
      {label}
    </span>
  );
}

/** 작은 사진 카드 알약: 영어 '~1.9K people'은 칸을 넘쳐 잘린다 → 숫자만 (UI QA 13차) */
export const shortPeople = (s: string) => s.replace(/ people$/, "");
