"use client";

import { useEffect } from "react";

/** 운영자 브라우저는 이용 집계에서 뺀다 (관리자 화면을 한 번 열면 이 브라우저에 표시가 남는다) */
export function NoTrack() {
  useEffect(() => {
    try {
      localStorage.setItem("cv:notrack", "1");
    } catch {}
  }, []);
  return null;
}
