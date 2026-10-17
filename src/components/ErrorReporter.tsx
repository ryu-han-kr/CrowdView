"use client";

import { useEffect } from "react";

/** 브라우저에서 난 오류를 /api/log 로 보낸다 (한 번 열 때 최대 5건, 같은 내용은 한 번) */
export function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    const send = (message: string, stack?: string) => {
      if (!message || seen.has(message) || seen.size >= 5) return;
      seen.add(message);
      const body = JSON.stringify({ message, stack, url: location.pathname });
      // 페이지를 떠나는 중에도 보내지도록 sendBeacon 우선
      if (!navigator.sendBeacon?.("/api/log", new Blob([body], { type: "application/json" }))) {
        fetch("/api/log", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    };
    const onError = (e: ErrorEvent) => send(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      send(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
