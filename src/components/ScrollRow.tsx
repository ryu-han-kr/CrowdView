"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 옆으로 넘기는 칩 줄 (날짜·시각·분류). 화면 밖으로 넘칠 때만 아래에 짧은 막대(_)를 보여 옆으로 밀 수 있다는 걸 알려 준다.
 * 막대 안의 진한 부분이 지금 보이는 위치 (경수님 10/30)
 */
export function ScrollRow({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { scrollWidth: sw, clientWidth: cw, scrollLeft: sl } = el;
      setBar(sw > cw + 2 ? { width: (cw / sw) * 100, left: (sl / sw) * 100 } : null);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);
  return (
    <>
      <div ref={ref} className={className}>
        {children}
      </div>
      {bar && (
        <div aria-hidden className="mx-auto mt-1.5 h-1 w-14 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-gray-400 transition-[margin]" style={{ width: `${bar.width}%`, marginLeft: `${bar.left}%` }} />
        </div>
      )}
    </>
  );
}
