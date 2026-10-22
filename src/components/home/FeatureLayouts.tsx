"use client";

import Image from "next/image";
import Link from "@/i18n/link";
import { Glyph } from "@/components/Glyph";
import { useI18n } from "@/i18n/client";
import { canOptimize } from "@/lib/img";
import { inkOf, levelOf } from "@/lib/levels";
import { useFavorites } from "@/lib/prefs";
import type { PhotoCardItem } from "./PhotoRail";

// 배치 다양화 (사용자 10/22: 줄·정사각 격자만 있어 단조롭다)
// - FeatureGrid: 큰 카드 1장 + 작은 카드 4장 (휴대폰: 위 큰 카드, 아래 2×2 / PC: 왼쪽 큰 카드, 오른쪽 2×2)
// - SplitFeature: 왼쪽 큰 사진(제목·설명·버튼) + 오른쪽 작은 카드 3장 (휴대폰: 위 큰 사진, 아래 가로 3장)

function Head({ title, sub, moreHref }: { title: string; sub?: string; moreHref?: string }) {
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

function Heart({ id, className = "" }: { id: string; className?: string }) {
  const { t } = useI18n();
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      aria-label={fav ? t("즐겨찾기 해제") : t("즐겨찾기")}
      aria-pressed={fav}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm transition active:scale-90 ${className}`}
    >
      <Glyph e={fav ? "❤️" : "🤍"} className={`h-[18px] w-[18px] ${fav ? "text-rose-500" : "text-white"}`} />
    </button>
  );
}

function Tag({ tag }: { tag: NonNullable<PhotoCardItem["tag"]> }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-white/95 py-0.5 pr-2.5 pl-1 text-[12px] font-extrabold shadow-sm"
      style={{ color: tag.color }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 작은 고정 아이콘 */}
      <img src={`/icons/3d/${tag.icon}.webp`} alt="" width={18} height={18} className="h-[18px] w-[18px]" />
      {tag.label}
    </span>
  );
}

/** 사진 위 아래쪽 흰 굵은 단계 줄 */
function LevelLine({ item, big = false }: { item: PhotoCardItem; big?: boolean }) {
  const { t } = useI18n();
  const lv = item.score !== undefined ? levelOf(item.score) : undefined;
  if (!lv && !item.badge) return null;
  return (
    <p className="truncate text-white drop-shadow">
      {lv ? (
        <>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/80" style={{ background: lv.color }} />
          <b className={big ? "text-[20px] font-black" : "text-[15px] font-extrabold"}>{t(lv.label)}</b>
          {item.people && <span className={`ml-1 font-bold ${big ? "text-[15px]" : "text-[12px]"}`}>{item.people}</span>}
        </>
      ) : (
        <b className="text-[14px] font-extrabold">{item.badge}</b>
      )}
    </p>
  );
}

function Photo({ item, sizes, eager }: { item: PhotoCardItem; sizes: string; eager?: boolean }) {
  return item.img ? (
    <Image
      src={item.img}
      alt=""
      fill
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      unoptimized={!canOptimize(item.img)}
      className="object-cover transition-transform duration-300 md:group-hover:scale-105"
    />
  ) : (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-400">
      <Glyph e={item.emoji ?? "📍"} className="h-12 w-12" />
    </div>
  );
}

function CardLink({ item, className, children }: { item: PhotoCardItem; className: string; children: React.ReactNode }) {
  return item.external ? (
    <a href={item.href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={item.href} className={className}>
      {children}
    </Link>
  );
}

/** 큰 카드 1 + 작은 카드 4 */
export function FeatureGrid({
  title,
  sub,
  moreHref,
  items,
  className = "mt-10 md:mt-14",
}: {
  title?: string;
  sub?: string;
  moreHref?: string;
  items: PhotoCardItem[];
  className?: string;
}) {
  if (items.length < 3) return null;
  const [big, ...rest] = items.slice(0, 5);
  return (
    <section className={className}>
      {title && <Head title={title} sub={sub} moreHref={moreHref} />}
      <div className={`grid gap-2.5 md:grid-cols-2 md:gap-3 ${title ? "mt-3" : ""}`}>
        {/* 큰 카드: 사진 안에 이름·설명·단계 */}
        <CardLink item={big} className="group relative block aspect-[16/11] overflow-hidden rounded-3xl bg-gray-100 md:aspect-auto md:min-h-[420px]">
          <Photo item={big} sizes="(min-width: 768px) 50vw, 100vw" eager />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />
          <div className="absolute top-3 left-3 flex items-center gap-1.5">{big.tag && <Tag tag={big.tag} />}</div>
          {big.favId && <Heart id={big.favId} className="absolute top-3 right-3 h-10 w-10" />}
          <div className="absolute inset-x-4 bottom-4 md:inset-x-6 md:bottom-6">
            <p className="text-[24px] leading-tight font-black break-keep text-white drop-shadow md:text-[30px]">{big.title}</p>
            {big.sub && <p className="mt-0.5 truncate text-sm font-semibold text-white/90">{big.sub}</p>}
            <div className="mt-1.5">
              <LevelLine item={big} big />
            </div>
          </div>
        </CardLink>
        {/* 작은 카드 2×2: 사진 + 아래 글 */}
        <ul className="grid grid-cols-2 gap-2.5 md:gap-3">
          {rest.map((it) => (
            <li key={it.id}>
              <CardLink item={it} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100 md:aspect-[5/4]">
                  <Photo item={it} sizes="(min-width: 768px) 25vw, 50vw" />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 to-transparent" />
                  {it.tag && (
                    <div className="absolute top-2 left-2 scale-90 origin-top-left">
                      <Tag tag={it.tag} />
                    </div>
                  )}
                  {it.favId && <Heart id={it.favId} className="absolute top-2 right-2" />}
                  <div className="absolute inset-x-2.5 bottom-2">
                    <LevelLine item={it} />
                  </div>
                </div>
                <p className="mt-1.5 truncate text-[15px] font-bold text-gray-950">{it.title}</p>
                {it.sub && <p className="truncate text-[13px] font-medium text-gray-600">{it.sub}</p>}
              </CardLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** 왼쪽 큰 사진(제목·설명·버튼) + 오른쪽 작은 카드 3장 */
export function SplitFeature({
  title,
  sub,
  hero,
  items,
}: {
  title: string;
  sub?: string;
  hero: { img?: string; title: string; desc?: string; href: string; cta: string };
  items: PhotoCardItem[];
}) {
  const { t } = useI18n();
  if (!items.length) return null;
  return (
    <section className="mt-10 md:mt-14">
      <Head title={title} sub={sub} />
      <div className="mt-3 overflow-hidden rounded-3xl border border-gray-200 bg-white md:grid md:grid-cols-[1fr_1.35fr]">
        <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[320px]">
          {hero.img && (
            <Image src={hero.img} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" unoptimized={!canOptimize(hero.img)} className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/45" />
          <div className="absolute top-5 right-5 left-5 md:top-8 md:left-8">
            <p className="text-[22px] leading-tight font-black break-keep text-white drop-shadow md:text-[28px]">{hero.title}</p>
            {hero.desc && <p className="mt-1 text-sm font-semibold text-white/90">{hero.desc}</p>}
          </div>
          <a
            href={hero.href}
            className="absolute bottom-4 left-5 rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-900 shadow md:bottom-8 md:left-8"
          >
            {hero.cta} ›
          </a>
        </div>
        <ul className="grid grid-cols-3 gap-2.5 p-3 md:gap-4 md:p-6">
          {items.slice(0, 3).map((x) => {
            const lv = x.score !== undefined ? levelOf(x.score) : undefined;
            return (
              <li key={x.id}>
                <CardLink item={x} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-100">
                    <Photo item={x} sizes="(min-width: 768px) 15vw, 30vw" />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug font-semibold text-gray-800 md:text-sm">{x.title}</p>
                  {lv ? (
                    <p className="truncate text-[15px] font-extrabold" style={{ color: inkOf(lv.color) }}>
                      {t(lv.label)}
                      {x.people && <span className="ml-1 text-[12px] font-bold text-gray-700">{x.people}</span>}
                    </p>
                  ) : (
                    x.sub && <p className="truncate text-[12px] font-semibold text-gray-600">{x.sub}</p>
                  )}
                </CardLink>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
