"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const KEY = "cv:back:scroll";
// 뒤로 온 화면의 목록·사진이 다 그려질 때까지 기다리는 시간
const MAX_WAIT_MS = 5000;
// 다른 화면에서 라우터가 멈춘 경우 기다림을 푸는 시간
const ROUTER_WAIT_MS = 8000;
const STABLE_MS = 400;

const urlKey = () => location.pathname + location.search;

/**
 * 뒤로 가면 보던 자리로 (경수님 QA 11/1). 목록을 되살리는 건 lib/back-restore,
 * 여기서는 그렇게 길어진 화면이 그 자리까지 닿을 때까지 기다렸다가 스크롤한다 (브라우저 자체 복원은 짧은 화면에서 끝나 버린다).
 * 같은 주소 안의 뒤로 가기(홈 칩)는 HomeList가 맡는다
 */
export function BackScroll() {
  const pathname = usePathname();
  const saved = useRef<Record<string, number>>({});
  const restoring = useRef(false);
  const pending = useRef<number | null>(null);
  const lastPath = useRef("");
  const cancel = useRef<() => void>(() => {});

  const run = (y: number) => {
    cancel.current();
    restoring.current = true;
    const start = performance.now();
    let stableSince = 0;
    let id = 0;
    const stop = () => {
      cancelAnimationFrame(id);
      restoring.current = false;
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("keydown", stop);
      cancel.current = () => {};
    };
    cancel.current = stop;
    const tick = () => {
      const now = performance.now();
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const want = Math.min(y, max);
      if (Math.abs(window.scrollY - want) > 2) window.scrollTo({ top: want, behavior: "instant" });
      if (max >= y - 2) {
        stableSince ||= now;
        if (now - stableSince > STABLE_MS) return stop();
      } else stableSince = 0;
      if (now - start > MAX_WAIT_MS) return stop();
      id = requestAnimationFrame(tick);
    };
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("keydown", stop);
    id = requestAnimationFrame(tick);
  };

  useEffect(() => {
    lastPath.current = location.pathname;
    try {
      saved.current = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
    } catch {}
    const persist = () => {
      try {
        sessionStorage.setItem(KEY, JSON.stringify(saved.current));
      } catch {}
    };
    const onScroll = () => {
      if (!restoring.current) saved.current[urlKey()] = window.scrollY;
    };
    let routerTimer = 0;
    const onPop = () => {
      const y = saved.current[urlKey()];
      if (location.pathname === lastPath.current || !y) return;
      // 라우터가 뒤 화면을 그린 뒤(아래 pathname 효과)에 시작한다. 그때까지 옛 화면의 스크롤을 뒤 화면 자리로 적지 않는다
      pending.current = y;
      restoring.current = true;
      clearTimeout(routerTimer);
      routerTimer = window.setTimeout(() => {
        if (pending.current === null) return;
        pending.current = null;
        restoring.current = false;
      }, ROUTER_WAIT_MS);
    };
    const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "back_forward" && saved.current[urlKey()]) run(saved.current[urlKey()]);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPop);
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      clearTimeout(routerTimer);
      cancel.current();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
    };
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    lastPath.current = location.pathname;
    if (pending.current === null) return;
    const y = pending.current;
    pending.current = null;
    run(y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
