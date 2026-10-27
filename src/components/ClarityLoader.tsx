"use client";

import { useEffect } from "react";

/**
 * Microsoft Clarity (화면 녹화·열지도, 경수님 10/27 프로젝트 생성). 애드센스와 같이 첫 그림을 밀지 않도록
 * 첫 스크롤·터치·키 입력 때, 그것도 없으면 화면이 뜨고 4초 뒤에 받는다
 */
export function ClarityLoader({ id }: { id: string }) {
  useEffect(() => {
    let done = false;
    const load = () => {
      if (done || document.getElementById("clarity-js")) return;
      done = true;
      const w = window as unknown as { clarity?: ((...a: unknown[]) => void) & { q?: unknown[] } };
      w.clarity ??= Object.assign((...a: unknown[]) => (w.clarity!.q ??= []).push(a), { q: [] as unknown[] });
      const s = document.createElement("script");
      s.id = "clarity-js";
      s.async = true;
      s.src = `https://www.clarity.ms/tag/${id}`;
      document.head.appendChild(s);
      for (const ev of EVENTS) window.removeEventListener(ev, load);
    };
    const EVENTS = ["scroll", "pointerdown", "touchstart", "keydown"] as const;
    for (const ev of EVENTS) window.addEventListener(ev, load, { passive: true, once: true });
    const after = () => setTimeout(load, 4000);
    if (document.readyState === "complete") after();
    else window.addEventListener("load", after, { once: true });
    return () => {
      for (const ev of EVENTS) window.removeEventListener(ev, load);
    };
  }, [id]);
  return null;
}
