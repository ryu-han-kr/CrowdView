// 브라우저 오류 추적 (Sentry). NEXT_PUBLIC_SENTRY_DSN이 있을 때만 켜지고, 없으면 아무것도 불러오지 않는다.
// 첫 화면 속도 (10/23 Lighthouse: Sentry 묶음 545KB가 첫 화면에 받아져 휴대폰 LCP 6~8초):
// - @sentry/nextjs(리플레이·추적 포함) 대신 가벼운 @sentry/browser만, 리플레이·성능 추적은 쓰지 않는다
// - 페이지가 다 뜬 뒤 한가할 때 불러오고, 그 전에 난 오류는 모아 두었다가 넘긴다
// 운영(production)에서만 켠다: 미리보기 배포·로컬은 무료 한도를 쓰지 않게
const dsn = process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? process.env.NEXT_PUBLIC_SENTRY_DSN : undefined;
// 한 화면에서 보내는 오류는 많아야 5건 (같은 오류가 반복돼 한도를 다 쓰지 않게)
let sent = 0;

if (dsn && typeof window !== "undefined") {
  const early: unknown[] = [];
  const onError = (e: ErrorEvent) => early.push(e.error ?? e.message);
  const onRejection = (e: PromiseRejectionEvent) => early.push(e.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const start = () =>
    import("@/lib/sentry-client")
      .then((Sentry) => {
        Sentry.init({
          dsn,
          environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
          beforeSend: (event) => (++sent > 5 ? null : event),
          // 광고·확장 프로그램·지도처럼 우리 코드가 아닌 곳의 소음
          ignoreErrors: [/adsbygoogle/i, /ResizeObserver loop/i, /Non-Error promise rejection/i],
          denyUrls: [/extensions\//i, /^chrome:\/\//i, /googlesyndication\.com/i, /pstatic\.net/i],
        });
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onRejection);
        for (const err of early) Sentry.captureException(err);
      })
      .catch(() => {});
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(() => start(), { timeout: 4000 }) : setTimeout(start, 2000));
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}

export {};
