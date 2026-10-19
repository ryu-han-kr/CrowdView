// 브라우저 오류 추적 (Sentry). NEXT_PUBLIC_SENTRY_DSN이 있을 때만 켜지고, 없으면 아무것도 불러오지 않는다.
// Sentry 코드는 따로 나눠 불러와(동적 import) 첫 화면 속도에 영향을 주지 않는다.
// 세션 리플레이: 오류가 난 경우에만 그 직전 화면 흐름을 남긴다. 글자·입력값·사진은 모두 가려서 보낸다 (개인정보처리방침 3장)
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
        // 성능 추적은 5%만 (무료 한도 안에서)
        tracesSampleRate: 0.05,
        // 평소 세션은 녹화하지 않고, 오류가 난 세션만
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1,
        integrations: [Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })],
        // 광고·확장 프로그램·지도처럼 우리 코드가 아닌 곳의 소음
        ignoreErrors: [/adsbygoogle/i, /ResizeObserver loop/i, /Non-Error promise rejection/i],
        denyUrls: [/extensions\//i, /^chrome:\/\//i, /googlesyndication\.com/i, /pstatic\.net/i],
      }),
    )
    .catch(() => {});
}

export {};
