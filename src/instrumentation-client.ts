// 브라우저 오류 추적 (Sentry). NEXT_PUBLIC_SENTRY_DSN이 있을 때만 켜지고, 없으면 아무것도 불러오지 않는다.
// Sentry 코드는 따로 나눠 불러와(동적 import) 첫 화면 속도에 영향을 주지 않는다.
// 세션 리플레이: 오류가 난 경우에만 그 직전 화면 흐름을 남긴다. 글자·입력값·사진은 모두 가려서 보낸다 (개인정보처리방침 3장)
// 운영(production)에서만 켠다: 미리보기 배포·로컬은 무료 한도를 쓰지 않게
const dsn = process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? process.env.NEXT_PUBLIC_SENTRY_DSN : undefined;
// 한 화면에서 보내는 오류는 많아야 5건 (같은 오류가 반복돼 한도를 다 쓰지 않게)
let sent = 0;

if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
        // 성능 추적은 1%만 (무료 한도 안에서)
        tracesSampleRate: 0.01,
        // 평소 세션은 녹화하지 않고, 오류가 난 세션 중 10%만 (무료 리플레이는 월 50개)
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0.1,
        beforeSend: (event) => (++sent > 5 ? null : event),
        integrations: [Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })],
        // 광고·확장 프로그램·지도처럼 우리 코드가 아닌 곳의 소음
        ignoreErrors: [/adsbygoogle/i, /ResizeObserver loop/i, /Non-Error promise rejection/i],
        denyUrls: [/extensions\//i, /^chrome:\/\//i, /googlesyndication\.com/i, /pstatic\.net/i],
      }),
    )
    .catch(() => {});
}

export {};
