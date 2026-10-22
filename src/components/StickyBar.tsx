"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 위에 붙어 따라오는 줄. 평소엔 배경이 투명해서 페이지 그라데이션이 비치고,
 * 스크롤해서 위에 붙었을 때만 불투명한 흰 배경을 깐다 (아래 사진이 비쳐 보이지 않게)
 */
export function StickyBar({ id, className = "", children }: { id?: string; className?: string; children: React.ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    // 상단 메뉴(태블릿·PC 64px) 아래로 지나가면 붙은 것
    const top = window.matchMedia("(min-width: 768px)").matches ? 64 : 0;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: `-${top + 1}px 0px 0px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div ref={sentinel} aria-hidden className="h-0" />
      {/* data-stuck: 붙었을 때만 숨기거나 보일 것 (group-data-[stuck=true]/sticky:…) */}
      <div id={id} data-stuck={stuck} className={`group/sticky sticky top-0 z-20 transition-colors md:top-16 ${stuck ? "bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]" : "bg-transparent"} ${className}`}>
        {children}
      </div>
    </>
  );
}
