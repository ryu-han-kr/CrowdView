import Link from "@/i18n/link";
import { localePath, type Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";
import { Glyph } from "@/components/Glyph";

// 홈 아이콘 메뉴: 누르면 그 탭(페이지)으로 간다. 그림은 Lucide 선 아이콘 + 은은한 색 타일 (아이콘 색은 타일과 같은 계열의 진한 색)
const ITEMS: { href: string; label: string; emoji: string; bg: string; fg: string; badge?: string }[] = [
  { href: "/airport", label: "공항", emoji: "✈️", bg: "from-sky-50 to-blue-100", fg: "text-sky-600", badge: "실시간" },
  { href: "/?cat=themepark#places", label: "테마파크", emoji: "🎡", bg: "from-pink-50 to-rose-100", fg: "text-rose-500" },
  { href: "/?cat=waterpark#places", label: "워터파크", emoji: "🌊", bg: "from-cyan-50 to-sky-100", fg: "text-cyan-600" },
  { href: "/?cat=ski#places", label: "스키장", emoji: "⛷️", bg: "from-slate-50 to-blue-100", fg: "text-blue-600" },
  { href: "/events", label: "축제", emoji: "🎆", bg: "from-violet-50 to-purple-100", fg: "text-violet-600" },
  { href: "/seoul", label: "서울 실시간", emoji: "📍", bg: "from-indigo-50 to-indigo-100", fg: "text-indigo-600", badge: "121곳" },
  { href: "/explore", label: "지역 여행", emoji: "🗺️", bg: "from-emerald-50 to-teal-100", fg: "text-emerald-700", badge: "NEW" },
  { href: "/guide", label: "여행 가이드", emoji: "📖", bg: "from-amber-50 to-orange-100", fg: "text-orange-500" },
  { href: "/route", label: "추천 코스", emoji: "🧭", bg: "from-blue-50 to-cyan-100", fg: "text-cyan-600" },
  { href: "/near?tab=reservation", label: "체험·액티비티", emoji: "🎟️", bg: "from-fuchsia-50 to-pink-100", fg: "text-fuchsia-600" },
  { href: "/near", label: "내 주변", emoji: "🚻", bg: "from-lime-50 to-green-100", fg: "text-green-600" },
  { href: "/map", label: "지도", emoji: "🗾", bg: "from-slate-50 to-slate-200", fg: "text-slate-600" },
];

const TILE = "group flex w-[68px] flex-col items-center gap-1.5 pt-3 md:w-[84px]";

/**
 * 휴대폰: 두 줄 격자로 한 화면에 10개가 보이고 옆으로 밀면 나머지 (NOL 레퍼런스 10/21, 전엔 한 줄 12개를 밀어야 했다).
 * 태블릿·PC: 한 줄에 전부
 */
export function CategoryIcons({ t, lang }: { t: T; lang: Lang }) {
  return (
    <nav aria-label={t("바로가기")} className="no-scrollbar -mx-5 mt-5 overflow-x-auto px-5 md:mx-0 md:mt-8 md:px-0">
      <ul className="grid grid-flow-col grid-rows-2 gap-x-1 gap-y-2 md:flex md:justify-between">
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
                  className={`flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br shadow-sm ring-1 ring-black/[0.03] transition-transform md:h-16 md:w-16 md:group-hover:-translate-y-0.5 ${it.bg} ${it.fg}`}
                >
                  <Glyph e={it.emoji} className="h-7 w-7 md:h-8 md:w-8" />
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
