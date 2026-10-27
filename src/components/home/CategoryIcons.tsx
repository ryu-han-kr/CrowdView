import Link from "@/i18n/link";
import { localePath, type Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";
import { SolarIcon } from "@/components/icons/SolarIcon";
import type { SolarName } from "@/components/icons/solar";

// 홈 아이콘 메뉴: 누르면 그 탭(페이지)으로 간다.
// 그림은 Solar 채운 아이콘 + 연한 색 원 (10/27 홈 2차: 입체 이모지(3D)는 탭·본문의 평면 Solar 와 그림 언어가 섞여 통일)
const ITEMS: { href: string; label: string; icon: SolarName; tone: string; badge?: string }[] = [
  { href: "/airport", label: "공항", icon: "plane", tone: "bg-sky-50 text-sky-600", badge: "실시간" },
  { href: "/?cat=themepark#places", label: "테마파크", icon: "ferris-wheel", tone: "bg-violet-50 text-violet-600" },
  { href: "/?cat=waterpark#places", label: "워터파크", icon: "waterdrops", tone: "bg-cyan-50 text-cyan-600" },
  { href: "/?cat=ski#places", label: "스키장", icon: "snowflake", tone: "bg-blue-50 text-blue-600" },
  { href: "/?cat=indoor#places", label: "실내 액티비티", icon: "gamepad-minimalistic", tone: "bg-fuchsia-50 text-fuchsia-600", badge: "NEW" },
  { href: "/events", label: "축제", icon: "confetti", tone: "bg-pink-50 text-pink-600" },
  { href: "/seoul", label: "서울 실시간", icon: "buildings-2", tone: "bg-indigo-50 text-indigo-600", badge: "121곳" },
  // 지역 여행 화면 대신 홈 통합 검색의 '명소' 탭 (사용자 10/22)
  { href: "/?tab=landmark#places", label: "명소", icon: "compass", tone: "bg-amber-50 text-amber-600" },
  { href: "/guide", label: "여행 가이드", icon: "book-2", tone: "bg-emerald-50 text-emerald-600" },
  { href: "/route", label: "추천 코스", icon: "route", tone: "bg-orange-50 text-orange-600" },
  { href: "/near?tab=reservation", label: "체험·액티비티", icon: "ticket", tone: "bg-rose-50 text-rose-600" },
  { href: "/near", label: "내 주변", icon: "target", tone: "bg-teal-50 text-teal-600" },
  { href: "/map", label: "지도", icon: "map", tone: "bg-lime-50 text-lime-700" },
];

const TILE = "group flex w-[72px] flex-col items-center gap-1.5 pt-3 md:w-[88px]";

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
                  className={`flex h-[60px] w-[60px] items-center justify-center rounded-[20px] transition-transform md:h-[68px] md:w-[68px] md:group-hover:-translate-y-0.5 ${it.tone}`}
                >
                  <SolarIcon name={it.icon} className="h-8 w-8 md:h-9 md:w-9" />
                </span>
              </span>
              {/* 칸 폭(72px) 안에서 두 줄까지 (UI QA 13차: 일본어 'スキー場ソウルリアルタイ…'처럼 이름이 옆 칸으로 넘쳤다) */}
              <span className="line-clamp-2 w-full text-center text-[13px] leading-tight font-semibold break-keep text-gray-800 md:text-sm">
                {t(it.label)}
              </span>
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
