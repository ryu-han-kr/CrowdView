// 화면 자동 시험 (Playwright). 휴대폰(크롬·사파리 엔진)과 PC에서 주요 화면이 열리고, 깨지지 않는지 본다.
// - 로컬/CI: `npm run build` 후 `npm run e2e` → 이 설정이 `next start`를 띄워 시험한다 (비밀 키가 없으면 예측 데이터로 동작)
// - 운영: `E2E_BASE_URL=https://crowdview.app npm run e2e`
// - 화면 사진(전·후 비교용): `npm run e2e:screens` → test-results/screens/<기기>/*.png
import { defineConfig, devices } from "@playwright/test";

const external = process.env.E2E_BASE_URL;
const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // 화면 사진(@screens)은 `--grep @screens`로 부를 때만
  grepInvert: process.argv.some((a) => a.includes("@screens")) ? undefined : /@screens/,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    // 해외 서버(CI)에서도 한국어 화면으로 (언어 선택 쿠키와 같은 효과)
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    extraHTTPHeaders: { "accept-language": "ko" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  // 주소를 주지 않으면 빌드된 앱을 직접 띄운다 (-H를 주지 않는다: 127.0.0.1로 고정하면 언어 경로 rewrite가 되돌이 redirect가 된다)
  webServer: external
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/en`,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: { NEXT_PUBLIC_NAVER_MAP_CLIENT_ID: "" },
      },
});
