"use client";

import Link from "@/i18n/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { stripLang } from "@/i18n/config";
import { LangSwitcher } from "./LangSwitcher";

export const TABS = [
  { href: "/", label: "홈", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/map", label: "지도", icon: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" },
  { href: "/airport", label: "공항", icon: "M10.5 3.5a1.5 1.5 0 0 1 3 0V9l7 4v2l-7-2v4.5l2 1.5v1.5l-3.5-1-3.5 1V19l2-1.5V13l-7 2v-2l7-4z" },
  { href: "/me", label: "마이", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0" },
];

/** 이벤트·장소 상세는 홈에서 들어가므로 홈 탭을 켠다 */
export function isTabActive(href: string, fullPath: string): boolean {
  const pathname = stripLang(fullPath).path;
  return href === "/"
    ? pathname === "/" || pathname.startsWith("/events") || pathname.startsWith("/festival") || pathname.startsWith("/place")
    : pathname.startsWith(href);
}

/** 태블릿·PC(md 이상) 상단 내비게이션. 모바일은 하단 탭(BottomNav)을 그대로 쓴다 */
export function TopNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-gray-100 bg-white md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          <span className="text-indigo-600">Crowd</span>View
        </Link>
        <nav className="flex gap-1">
          {/* 공항은 홈의 파트 탭으로 들어간다 (상단 메뉴에서는 뺌) */}
          {TABS.filter((tab) => tab.href !== "/airport").map((tab) => {
            const active = isTabActive(tab.href, pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" strokeLinecap="round">
                  <path d={tab.icon} />
                </svg>
                {t(tab.label)}
              </Link>
            );
          })}
        </nav>
        <p className="ml-auto text-xs text-gray-400">{t("실시간 혼잡도 · AI 예측")}</p>
        <LangSwitcher />
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-gray-100 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((tab) => {
          const active = isTabActive(tab.href, pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-indigo-600" : "text-gray-400"
                }`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${active ? "bg-indigo-50" : ""}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinejoin="round" strokeLinecap="round">
                    <path d={tab.icon} />
                  </svg>
                </span>
                {t(tab.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
