// 서버 오류 추적 (Sentry). SENTRY_DSN(또는 NEXT_PUBLIC_SENTRY_DSN)이 있을 때만 켜진다. 없으면 Sentry를 불러오지 않고 디스코드 운영 알림으로 대신 받는다.
// 서버 오류에는 요청 주소·오류 내용만 담기고, 회원 정보(쿠키·IP)는 보내지 않는다 (Sentry 기본값: 개인정보 안 보냄)
import type { Instrumentation } from "next";

// 운영(production)에서만 보낸다: 미리보기 배포·CI·로컬 빌드는 무료 한도(Developer: 오류 월 5천 건)를 쓰지 않게
const dsn = process.env.VERCEL_ENV === "production" ? (process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN) : undefined;

export async function register() {
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    // 성능 추적은 1%만 (무료 한도 안에서). 무료 플랜은 한도를 넘으면 버려질 뿐 과금되지 않는다
    tracesSampleRate: 0.01,
    // 외부 API 요청에 추적 헤더(sentry-trace·baggage)를 붙이지 않는다.
    // 10/23: 공공데이터포털이 baggage 헤더가 붙은 요청을 400(INVALID_REQUEST)으로 거부해 공항·기상 등 수집이 Sentry를 켠 뒤로 전부 실패했다
    tracePropagationTargets: [],
  });
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn) {
    // Sentry를 넣기 전에는 운영 알림(디스코드)으로 대신 받는다. 같은 오류는 10분에 한 번, 주소·경로·오류 글만 (개인정보 없음)
    if (process.env.VERCEL_ENV !== "production") return;
    const [err, request, context] = args;
    const message = err instanceof Error ? err.message : String(err);
    const { opsAlert } = await import("@/lib/ops");
    await opsAlert(`서버 오류: ${message.slice(0, 120)}`, { path: request.path.split("?")[0], route: context.routePath, kind: context.routeType }, {
      key: `srverr:${context.routePath}:${message.slice(0, 60)}`,
      cooldownS: 600,
    }).catch(() => {});
    return;
  }
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
