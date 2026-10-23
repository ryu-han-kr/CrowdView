// 브라우저 Sentry에서 쓰는 것만 (instrumentation-client가 나중에 동적으로 불러온다).
// 패키지 전체를 import("@sentry/browser")로 부르면 리플레이 등 안 쓰는 코드까지 묶여 409KB였다 → 이름을 골라 다시 내보내 크기를 줄인다
export { captureException, init } from "@sentry/browser";
