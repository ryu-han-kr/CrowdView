"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** 내부 링크를 누르면 화면 맨 위에 진행 막대를 띄우고, 주소가 바뀌면 지운다 (누른 게 먹혔는지 바로 보이게) */
export function NavProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => setLoading(false), [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      setLoading(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // 이동이 취소되거나 오래 걸려도 막대가 남지 않게
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setLoading(false), 10_000);
    return () => clearTimeout(id);
  }, [loading]);

  if (!loading) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]" role="progressbar" aria-busy="true">
      <div className="nav-progress h-full bg-indigo-500 shadow-[0_0_8px_rgb(99_102_241/0.7)]" />
    </div>
  );
}
