"use client";

import Link from "@/i18n/link";
import Image from "next/image";
import { useI18n } from "@/i18n/client";
import { canOptimize } from "@/lib/img";
import { useRecent } from "@/lib/prefs";
import { Glyph } from "@/components/Glyph";

/** 홈 '최근 본 곳': 이 기기에서 연 장소·지역·축제 (NOL '최근 본 상품' 레퍼런스). 기록이 없으면 아무것도 안 그린다 */
export function RecentRail() {
  const { t } = useI18n();
  const { recent, clear } = useRecent();
  if (!recent.length) return null;
  return (
    <section className="mt-8 md:mt-12">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold md:text-xl">{t("최근 본 곳")}</h2>
        <button onClick={clear} className="text-sm text-gray-500">
          {t("지우기")}
        </button>
      </div>
      <ul className="no-scrollbar -mx-5 mt-3 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 md:mx-0 md:scroll-px-0 md:px-0">
        {recent.map((r) => (
          <li key={r.id} className="w-[28%] shrink-0 snap-start sm:w-[20%] md:w-[12%]">
            <Link href={r.href} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
                {r.img ? (
                  <Image src={r.img} alt="" fill sizes="30vw" unoptimized={!canOptimize(r.img)} className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-400">
                    <Glyph e="📍" className="h-8 w-8" />
                  </div>
                )}
              </div>
              <p className="mt-1.5 line-clamp-1 text-xs font-semibold text-gray-900">{r.title}</p>
              {r.sub && <p className="truncate text-[11px] text-gray-500">{r.sub}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
