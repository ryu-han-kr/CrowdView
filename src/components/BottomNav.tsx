"use client";

import Link from "@/i18n/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { stripLang } from "@/i18n/config";
import { NavAuth } from "./AuthButtons";
import { LangSwitcher } from "./LangSwitcher";
import { PlusBadge } from "./PlusBadge";
import { SolarIcon } from "@/components/icons/SolarIcon";
import type { SolarName } from "@/components/icons/solar";

// 아이콘은 Solar(채운 모양). 사용자 10/26: 속이 빈 선 아이콘이 밋밋해 보여 전부 채운 모양으로
export const TABS: { href: string; label: string; icon: SolarName; desktopOnly?: boolean }[] = [
  { href: "/", label: "홈", icon: "home-2" },
  { href: "/map", label: "지도", icon: "map" },
  { href: "/airport", label: "공항", icon: "plane" },
  // 서울 실시간은 PC 상단 메뉴에만 (모바일 하단 탭은 그대로, 홈의 카드로 들어간다)
  // '지역 여행'은 홈 통합 검색 탭(명소·축제·관광지 + 지역 칩)으로 옮겼다 (사용자 10/22). /explore 주소는 그대로 둔다
  { href: "/guide", label: "여행 가이드", icon: "book-2", desktopOnly: true },
  {
    href: "/route",
    label: "추천 코스",
    icon: "route",
    desktopOnly: true,
  },
  {
    href: "/seoul",
    label: "서울 실시간",
    icon: "map-point",
    desktopOnly: true,
  },
  { href: "/me", label: "마이", icon: "user" },
];

/** 이벤트·장소 상세는 홈에서 들어가므로 홈 탭을 켠다 */
export function isTabActive(href: string, fullPath: string): boolean {
  const pathname = stripLang(fullPath).path;
  return href === "/"
    ? pathname === "/" || pathname.startsWith("/events") || pathname.startsWith("/festival") || pathname.startsWith("/place")
    : pathname.startsWith(href);
}

/** 태블릿·PC(md 이상) 상단 내비게이션. 모바일은 하단 탭(BottomNav)을 그대로 쓴다 */
export function TopNav({ authEnabled = false }: { authEnabled?: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-gray-100 bg-white md:block">
      {/* 헤더만 화면 폭을 넉넉히 쓴다 (경수님 10/29: 본문·배너 폭은 그대로). 1,152px 안에 묶여 넓은 PC에서 '마이'가 잘렸다 */}
      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-2 px-4 lg:gap-8 lg:px-8">
        <Link href="/" className="shrink-0 text-lg font-extrabold tracking-tight">
          <span className="text-indigo-600">Crowd</span>View
        </Link>
        <nav className="no-scrollbar flex min-w-0 gap-0.5 overflow-x-auto lg:gap-1">
          {/* 공항은 홈의 파트 탭으로 들어간다 (상단 메뉴에서는 뺌) */}
          {TABS.filter((tab) => tab.href !== "/airport").map((tab) => {
            const active = isTabActive(tab.href, pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                title={t(tab.label)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-[13px] font-semibold lg:px-3 lg:text-sm whitespace-nowrap transition-colors ${
                  active ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {/* 좁은 PC·태블릿(lg 아래)은 아이콘만: 메뉴가 옆으로 밀려 '마이'가 잘리던 것 (경수님 10/29) */}
                <SolarIcon name={tab.icon} className="h-5 w-5 lg:hidden xl:block" />
                <span className="sr-only lg:not-sr-only">{t(tab.label)}</span>
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto" aria-hidden />
        <p className="hidden text-xs whitespace-nowrap text-gray-500 2xl:block">{t("실시간 혼잡도 · AI 예측")}</p>
        {/* 오른쪽 버튼은 줄어들지 않게 (좁은 화면에서 '한국어'·'로그인'이 두 줄로 꺾이던 것) — 모자라면 메뉴 쪽이 옆으로 밀린다 */}
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          {authEnabled && <PlusBadge />}
          <LangSwitcher />
          <NavAuth enabled={authEnabled} />
        </div>
      </div>
    </header>
  );
}

/** 휴대폰 하단 탭 5개, 홈이 가운데 (NOL 레퍼런스 10/21: 카테고리·내주변·홈·찜·마이). 지역 여행이 '탐색'으로 들어온다 */
// 하단 첫 칸: 지역 여행(탐색)은 홈 통합 검색으로 옮기고, 한산한 코스 추천을 둔다 (사용자 10/22)
const MOBILE_TABS = ["/route", "/map", "/", "/airport", "/me"].map((href) => TABS.find((tab) => tab.href === href)!);
const MOBILE_LABEL: Record<string, string> = { "/route": "코스" };

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-gray-100 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {MOBILE_TABS.map((tab) => {
          const active = isTabActive(tab.href, pathname);
          const home = tab.href === "/";
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                // 하단 탭 5개를 한가할 때 미리 받으면 화면 JS 5벌이 더 내려온다 (10/26 성능) → 누를 때 받는다
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-indigo-600" : "text-gray-600"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                    home && active ? "bg-indigo-600 text-white" : active ? "bg-indigo-50" : ""
                  }`}
                >
                  <SolarIcon name={tab.icon} className="h-6 w-6" />
                </span>
                {t(MOBILE_LABEL[tab.href] ?? tab.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
