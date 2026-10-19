// 서버 오류 추적 (Sentry). SENTRY_DSN(또는 NEXT_PUBLIC_SENTRY_DSN)이 있을 때만 켜진다. 없으면 Sentry를 불러오지 않는다.
// 서버 오류에는 요청 주소·오류 내용만 담기고, 회원 정보(쿠키·IP)는 보내지 않는다 (Sentry 기본값: 개인정보 안 보냄)
import type { Instrumentation } from "next";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0.05,
  });
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
