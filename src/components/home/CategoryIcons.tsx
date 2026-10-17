import Link from "@/i18n/link";
import { localePath, type Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";

// 홈 아이콘 메뉴: 누르면 그 탭(페이지)으로 간다. 그림은 이모지 + 은은한 색 타일
const ITEMS: { href: string; label: string; emoji: string; bg: string; badge?: string }[] = [
  { href: "/airport", label: "공항", emoji: "✈️", bg: "from-sky-50 to-blue-100", badge: "실시간" },
  { href: "/?cat=themepark#places", label: "테마파크", emoji: "🎡", bg: "from-pink-50 to-rose-100" },
  { href: "/events", label: "축제", emoji: "🎆", bg: "from-violet-50 to-purple-100" },
  { href: "/seoul", label: "서울 실시간", emoji: "📍", bg: "from-indigo-50 to-indigo-100", badge: "121곳" },
  { href: "/explore", label: "지역 여행", emoji: "🗺️", bg: "from-emerald-50 to-teal-100", badge: "NEW" },
  { href: "/guide", label: "여행 가이드", emoji: "📖", bg: "from-amber-50 to-orange-100" },
  { href: "/route", label: "추천 코스", emoji: "🧭", bg: "from-blue-50 to-cyan-100" },
  { href: "/near?tab=reservation", label: "체험·액티비티", emoji: "🎟️", bg: "from-fuchsia-50 to-pink-100" },
  { href: "/near", label: "내 주변", emoji: "🚻", bg: "from-lime-50 to-green-100" },
  { href: "/map", label: "지도", emoji: "🗾", bg: "from-slate-50 to-slate-200" },
];

const TILE = "group flex w-[68px] flex-col items-center gap-1.5 pt-3 md:w-[84px]";

export function CategoryIcons({ t, lang }: { t: T; lang: Lang }) {
  return (
    <nav aria-label={t("바로가기")} className="no-scrollbar -mx-5 mt-6 overflow-x-auto px-5 md:mx-0 md:mt-8 md:px-0">
      <ul className="flex gap-1 md:justify-between">
        {ITEMS.map((it) => {
          const inner = (
            <>
              <span className="relative">
                {it.badge && (
                  <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-indigo-200 bg-white px-1.5 text-[10px] font-bold whitespace-nowrap text-indigo-600">
                    {t(it.badge)}
                  </span>
                )}
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-[28px] shadow-sm transition-transform md:h-16 md:w-16 md:text-[32px] md:group-hover:-translate-y-0.5 ${it.bg}`}
                >
                  {it.emoji}
                </span>
              </span>
              <span className="text-center text-xs font-medium whitespace-nowrap text-gray-700 md:text-[13px]">{t(it.label)}</span>
            </>
          );
          return (
            <li key={it.href} className="shrink-0">
              {/* 홈 안의 파트 고르기(?cat=)는 새로 열어야 목록이 그 파트로 바뀐다 */}
              {it.href.startsWith("/?") ? (
                <a href={localePath(lang, it.href)} className={TILE}>
                  {inner}
                </a>
              ) : (
                <Link href={it.href} className={TILE}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
