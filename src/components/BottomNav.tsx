"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "홈", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/map", label: "지도", icon: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" },
  { href: "/airport", label: "공항", icon: "M10.5 3.5a1.5 1.5 0 0 1 3 0V9l7 4v2l-7-2v4.5l2 1.5v1.5l-3.5-1-3.5 1V19l2-1.5V13l-7 2v-2l7-4z" },
  { href: "/me", label: "마이", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => {
          // 이벤트·장소 상세는 홈에서 들어가므로 홈 탭을 켠다
          const active =
            t.href === "/"
              ? pathname === "/" || pathname.startsWith("/events") || pathname.startsWith("/place")
              : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  active ? "text-gray-900" : "text-gray-400"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinejoin="round" strokeLinecap="round">
                  <path d={t.icon} />
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
