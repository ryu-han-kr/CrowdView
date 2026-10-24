"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 이용 집계 (lib/traffic). 페이지를 볼 때마다 1을 세고, 광고 노출·제휴 클릭과 함께 모아 4초 뒤(또는 화면을 떠날 때) 한 번 보낸다.
 * 익명 번호는 이 브라우저의 무작위 값이라 사람을 알 수 없다. 운영자는 관리자 화면에 들어가면 이 브라우저가 집계에서 빠진다 (cv:notrack)
 */
const q = { pv: 0, ads: [] as string[], aff: [] as string[] };
let timer: ReturnType<typeof setTimeout> | undefined;
/** 같은 주소를 연달아 두 번 세지 않게 (개발 모드 StrictMode가 효과를 두 번 돌린다) */
let lastPath = "";

const store = (s: Storage, k: string, make: () => string) => {
  try {
    return s.getItem(k) ?? (s.setItem(k, make()), s.getItem(k)) ?? make();
  } catch {
    return make();
  }
};

function flush() {
  clearTimeout(timer);
  timer = undefined;
  if (!q.pv && !q.ads.length && !q.aff.length) return;
  try {
    if (localStorage.getItem("cv:notrack") === "1") return void Object.assign(q, { pv: 0, ads: [], aff: [] });
  } catch {}
  let session = false;
  try {
    session = !sessionStorage.getItem("cv:ses");
    sessionStorage.setItem("cv:ses", "1");
  } catch {}
  const body = JSON.stringify({
    vid: store(localStorage, "cv:vid", () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36)),
    lang: document.documentElement.lang,
    mobile: matchMedia("(max-width: 767px)").matches,
    plus: document.documentElement.dataset.plus === "1",
    session: session && q.pv > 0,
    pv: q.pv,
    ads: q.ads,
    aff: q.aff,
  });
  Object.assign(q, { pv: 0, ads: [], aff: [] });
  if (!navigator.sendBeacon?.("/api/t", new Blob([body], { type: "application/json" }))) {
    fetch("/api/t", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}

const later = () => {
  if (!timer) timer = setTimeout(flush, 4000);
};

/** 광고 칸이 실제로 채워졌을 때 (AdUnit) */
export function trackAd(slot: string) {
  q.ads.push(slot);
  later();
}

export function TrafficBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === lastPath) return;
    lastPath = pathname;
    q.pv += 1;
    later();
  }, [pathname]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    // 제휴 링크(data-aff)를 누르면 세고 바로 보낸다 (새 창으로 떠나기 전에)
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("[data-aff]");
      if (!a) return;
      q.aff.push(a.getAttribute("data-aff")!);
      flush();
    };
    document.addEventListener("visibilitychange", onHide);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}
