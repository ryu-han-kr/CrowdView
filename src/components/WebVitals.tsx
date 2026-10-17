"use client";

import { useReportWebVitals } from "next/web-vitals";

// 실제 이용자 화면 속도(Core Web Vitals: LCP·INP·CLS)를 10% 표본만 모아, 페이지를 떠날 때 한 번에 보낸다 (Redis 쓰기를 아끼려고)
const SAMPLED = typeof window !== "undefined" && Math.random() < 0.1;
const KEEP = new Set(["LCP", "INP", "CLS"]);
const pending = new Map<string, string>();
let hooked = false;

function flush() {
  if (!pending.size) return;
  const body = JSON.stringify({ metrics: [...pending].map(([n, r]) => ({ n, r })) });
  pending.clear();
  if (!navigator.sendBeacon?.("/api/vitals", new Blob([body], { type: "application/json" })))
    fetch("/api/vitals", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}

// 함수가 바뀌면 다시 보고되므로 바깥에 둔다 (Next 문서)
const report: Parameters<typeof useReportWebVitals>[0] = (m) => {
  if (!SAMPLED || !KEEP.has(m.name)) return;
  pending.set(m.name, m.rating);
  if (!hooked) {
    hooked = true;
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  }
};

export function WebVitals() {
  useReportWebVitals(report);
  return null;
}
