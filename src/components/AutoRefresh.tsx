"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVERY = 10 * 60_000;

/**
 * 10분마다 화면 데이터 새로 받기 (경수님 10/30: 새로고침을 눌러야만 바뀌던 것). 서버 컴포넌트만 다시 받아 스크롤·입력은 그대로.
 * 탭이 숨어 있으면 건너뛰고, 다시 볼 때 10분이 지났으면 바로 받는다
 */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < EVERY) return;
      last = Date.now();
      router.refresh();
    };
    const id = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
