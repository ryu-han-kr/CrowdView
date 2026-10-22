import Link from "@/i18n/link";
import Image from "next/image";
import { canOptimize } from "@/lib/img";
import { LevelBadge } from "../Level";
import { Glyph } from "@/components/Glyph";

export interface RankItem {
  id: string;
  href: string;
  title: string;
  /** 두 번째 줄 (인원·대기 등) */
  sub?: string;
  /** 세 번째 줄 (평소 대비 등) */
  note?: string;
  img?: string;
  emoji?: string;
  score?: number;
  /** 바깥 주소(기사·공식 사이트)면 새 창 */
  external?: boolean;
  /** note를 진한 빨강으로 (검색량 급증 등) */
  hot?: boolean;
}

/** 큰 순위 숫자 + 글 + 오른쪽 사진 (NOL '많이 찾은 즐길거리' 레퍼런스 10/21) */
export function RankList({
  title,
  subtitle,
  moreHref,
  moreLabel,
  items,
}: {
  title: string;
  subtitle?: string;
  moreHref?: string;
  moreLabel?: string;
  items: RankItem[];
}) {
  if (!items.length) return null;
  return (
    <section className="mt-10 md:mt-14">
      <div className="flex items-end justify-between gap-3">
        <h2 className="min-w-0 text-lg font-bold md:text-xl">{title}</h2>
        {moreHref && moreLabel && (
          <Link href={moreHref} className="shrink-0 text-sm text-gray-500">
            {moreLabel} ›
          </Link>
        )}
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      <ol className="mt-2 divide-y divide-gray-100 md:grid md:grid-cols-2 md:gap-x-10 md:divide-y-0">
        {items.map((it, i) => (
          <li key={it.id}>
            <Link href={it.href} {...(it.external ? { target: "_blank", rel: "noreferrer" } : {})} className="flex items-center gap-4 py-3.5">
              <span className="w-8 shrink-0 text-center text-[28px] leading-none font-black text-gray-900 italic">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-gray-900">{it.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  {it.score !== undefined && <LevelBadge score={it.score} />}
                  {it.sub && <span className="truncate text-sm text-gray-700">{it.sub}</span>}
                </div>
                {it.note && <p className={`mt-0.5 truncate text-xs ${it.hot ? "font-bold text-rose-700" : "text-gray-600"}`}>{it.note}</p>}
              </div>
              <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-gray-100 md:h-20 md:w-20">
                {it.img ? (
                  <Image src={it.img} alt="" fill sizes="80px" unoptimized={!canOptimize(it.img)} className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-400">
                    <Glyph e={it.emoji ?? "📍"} className="h-7 w-7" />
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
