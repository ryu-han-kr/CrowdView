import Link from "@/i18n/link";
import { localePath, type Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";

// 홈 아이콘 메뉴: 누르면 그 탭(페이지)으로 간다. 그림은 3D 아이콘 (사용자 QA 10/22: 선 아이콘이 밋밋 → NOL 레퍼런스처럼 입체).
// 아이콘: Microsoft Fluent Emoji 3D (MIT, public/icons/3d/LICENSE-fluentui-emoji.txt)
const ITEMS: { href: string; label: string; icon: string; badge?: string }[] = [
  { href: "/airport", label: "공항", icon: "airport", badge: "실시간" },
  { href: "/?cat=themepark#places", label: "테마파크", icon: "themepark" },
  { href: "/?cat=waterpark#places", label: "워터파크", icon: "waterpark" },
  { href: "/?cat=ski#places", label: "스키장", icon: "ski" },
  { href: "/events", label: "축제", icon: "festival" },
  { href: "/seoul", label: "서울 실시간", icon: "seoul", badge: "121곳" },
  // 지역 여행 화면 대신 홈 통합 검색의 '명소' 탭 (사용자 10/22)
  { href: "/?tab=landmark#places", label: "명소", icon: "explore", badge: "NEW" },
  { href: "/guide", label: "여행 가이드", icon: "guide" },
  { href: "/route", label: "추천 코스", icon: "route" },
  { href: "/near?tab=reservation", label: "체험·액티비티", icon: "activity" },
  { href: "/near", label: "내 주변", icon: "near" },
  { href: "/map", label: "지도", icon: "map" },
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
                <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-[#f3f4fa] transition-transform md:h-[68px] md:w-[68px] md:group-hover:-translate-y-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 작은 고정 아이콘(4~9KB webp)이라 이미지 최적화 요금을 쓰지 않는다 */}
                  <img src={`/icons/3d/${it.icon}.webp`} alt="" width={40} height={40} className="h-10 w-10 md:h-11 md:w-11" />
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
