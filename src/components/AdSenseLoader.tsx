"use client";

import { useEffect } from "react";

/**
 * 구글 애드센스 스크립트 로더 (사용자 10/26 성능).
 * next/script lazyOnload는 '화면이 다 뜨면 바로' 실행돼 여전히 첫 그림(LCP)을 밀어냈다 → 첫 스크롤·터치·키 입력이 있거나,
 * 그것도 없으면 화면이 뜨고 4초 뒤에 받는다. 광고 자리(AdUnit)의 push는 배열에 쌓였다가 스크립트가 오면 처리된다.
 */
export function AdSenseLoader({ client }: { client: string }) {
  useEffect(() => {
    let done = false;
    const load = () => {
      if (done || document.getElementById("adsbygoogle-js")) return;
      done = true;
      const s = document.createElement("script");
      s.id = "adsbygoogle-js";
      s.async = true;
      s.crossOrigin = "anonymous";
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
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
  }, [client]);
  return null;
}
