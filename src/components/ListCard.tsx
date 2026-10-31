"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Glyph } from "@/components/Glyph";
import Link from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import { canOptimize } from "@/lib/img";
import { inkOf } from "@/lib/levels";
import { useFavorites } from "@/lib/prefs";

export interface ListCardItem {
  href: string;
  img?: string;
  /** 사진이 없을 때 그림 */
  emoji?: string;
  title: string;
  /** 지역·거리 등 둘째 줄 */
  sub?: string;
  /** 분류 꼬리표: 3D 아이콘(icon, public/icons/3d) 또는 이모지 */
  tag?: { label: string; color: string; icon?: string; emoji?: string };
  /** 지금 단계 (이름·색) */
  level?: { label: string; color: string };
  /** 단계 옆 굵은 인원 (예: 약 5,800명) */
  people?: string;
  trend?: "up" | "down" | "flat";
  /** 단계 대신 보일 말 (운영 종료·D-3 등) */
  badge?: string;
  /** 찜 하트 (우리 장소 id) */
  favId?: string;
  /** 하트 대신 오른쪽 위에 둘 버튼 (예: 가이드 별표) */
  action?: ReactNode;
  /** 첫 화면 사진은 바로 받는다 */
  eager?: boolean;
  /** 시험·지도 연결용 data-* 속성 */
  data?: Record<string, string | number>;
}

/**
 * 가로 카드: 사진(왼쪽) + 분류·이름·둘째 줄·지금 단계(오른쪽) + 찜. 회색 구역(sector) 안에 흰 카드로 놓는다.
 * 사용자 QA 10/22: 왼쪽→오른쪽으로 읽히게, 배경 차이로 구별. 홈 '전체 장소'·서울 실시간·여행 가이드가 같이 쓴다
 */
export function ListCard({ item }: { item: ListCardItem }) {
  const { t } = useI18n();
  const { isFavorite, toggle } = useFavorites();
  const fav = item.favId ? isFavorite(item.favId) : false;
  const dataAttrs = Object.fromEntries(Object.entries(item.data ?? {}).map(([k, v]) => [`data-${k}`, v]));
  return (
    <div className="relative">
      <Link
        href={item.href}
        {...dataAttrs}
        className="relative flex gap-3 rounded-2xl bg-white p-2.5 pr-3 shadow-[0_1px_2px_rgb(15_23_42/0.06)] transition active:scale-[0.99] md:hover:shadow-md"
      >
        <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {item.img ? (
            <Image
              src={item.img}
              alt=""
              fill
              sizes="208px"
              loading={item.eager ? "eager" : "lazy"}
              unoptimized={!canOptimize(item.img)}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-50 to-sky-100 text-indigo-400">
              <Glyph e={item.emoji ?? "📍"} className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          {item.tag && (
            // 분류 이름은 회색 한 가지로 (UI QA 10차: 분류마다 색이 달라 목록이 산만했다. 색은 혼잡 단계에만)
            <p className="flex items-center gap-1 text-[12px] font-bold text-gray-500">
              {item.tag.icon ? (
                // eslint-disable-next-line @next/next/no-img-element -- 작은 고정 아이콘
                <img src={`/icons/3d/${item.tag.icon}.webp`} alt="" width={16} height={16} className="h-4 w-4" />
              ) : (
                item.tag.emoji && <Glyph e={item.tag.emoji} className="h-3.5 w-3.5" />
              )}
              {item.tag.label}
            </p>
          )}
          {/* 이름은 두 줄까지 (11/1 UX 점검: '2026 숭례문 파수…'·'롯데월드타워 서울…'처럼 한 줄로 잘려 무슨 곳인지 몰랐다) */}
          <p className="mt-0.5 line-clamp-2 pr-8 text-base leading-snug font-extrabold break-keep text-gray-950">{item.title}</p>
          {item.sub && <p className="truncate text-[13px] font-medium text-gray-600">{item.sub}</p>}
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
            {item.level ? (
              <>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.level.color }} />
                <b className="text-[15px] font-extrabold" style={{ color: inkOf(item.level.color) }}>
                  {item.level.label}
                </b>
                {item.people && <span className="truncate text-[13px] font-bold text-gray-800">{item.people}</span>}
                {item.trend === "up" && <span className="shrink-0 text-xs font-bold text-red-700 dark:text-red-400">↑</span>}
                {item.trend === "down" && <span className="shrink-0 text-xs font-bold text-emerald-700">↓</span>}
              </>
            ) : item.badge ? (
              <b className="text-[14px] font-bold text-gray-600">{item.badge}</b>
            ) : (
              item.people && <span className="truncate text-[13px] font-bold text-gray-800">{item.people}</span>
            )}
          </p>
        </div>
      </Link>
      {item.action ? (
        <div className="absolute top-2 right-2">{item.action}</div>
      ) : (
        item.favId && (
          <button
            type="button"
            onClick={() => toggle(item.favId!)}
            aria-label={fav ? t("즐겨찾기 해제") : t("즐겨찾기")}
            aria-pressed={fav}
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full"
          >
            <Glyph e={fav ? "❤️" : "🤍"} className={`h-5 w-5 ${fav ? "text-rose-500" : "text-gray-400"}`} />
          </button>
        )
      )}
    </div>
  );
}
