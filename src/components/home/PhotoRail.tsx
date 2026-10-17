"use client";

import Link from "@/i18n/link";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { LevelBadge } from "../Level";

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
}

/** 세로로 긴 사진 카드 */
export function PhotoCard({ item, rank, className = "" }: { item: PhotoCardItem; rank?: number; className?: string }) {
  const body = (
    <>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-gray-100">
        {item.img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.img} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 md:group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-100 text-5xl">{item.emoji ?? "📍"}</div>
        )}
        {item.badge && (
          <span className="absolute top-2 left-2 rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-bold text-gray-900 shadow-sm">{item.badge}</span>
        )}
        {item.score !== undefined && (
          <span className="absolute top-2 right-2 rounded-full bg-white/95 shadow-sm">
            <LevelBadge score={item.score} />
          </span>
        )}
        {rank !== undefined && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
            <span className="absolute bottom-1 left-3 text-5xl leading-none font-black text-white italic drop-shadow md:text-6xl">{rank}</span>
          </>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-snug font-semibold break-keep text-gray-900">{item.title}</p>
      {item.sub && <p className="mt-0.5 truncate text-xs text-gray-500">{item.sub}</p>}
      {item.note && <p className="mt-0.5 truncate text-xs font-semibold text-rose-600">{item.note}</p>}
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
        <h2 className="min-w-0 text-lg font-bold md:text-xl">
          {title}
          {subtitle && <span className="ml-2 hidden text-sm font-normal text-gray-500 md:inline">{subtitle}</span>}
        </h2>
        {moreHref && (
          <Link href={moreHref} className="shrink-0 text-sm text-gray-500">
            {t("전체 보기")} ›
          </Link>
        )}
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500 md:hidden">{subtitle}</p>}
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
        <ul ref={ref} className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto scroll-smooth px-5 md:mx-0 md:gap-4 md:px-0">
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
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d={d > 0 ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
              </svg>
            </button>
          ))}
      </div>
    </section>
  );
}
