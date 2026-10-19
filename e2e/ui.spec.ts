// 고친 적 있는 화면 문제가 다시 생기지 않는지 (회귀 시험)
import { expect, test } from "@playwright/test";

test("PC 상단 메뉴: 언어·로그인 버튼이 한 줄 (두 줄로 꺾이지 않음)", async ({ page, isMobile }) => {
  test.skip(isMobile, "PC 메뉴");
  await page.goto("/");
  const lang = page.locator("header").getByRole("button", { name: "언어 선택" });
  await expect(lang).toBeVisible();
  const box = await lang.boundingBox();
  expect(box!.height).toBeLessThan(48);
});

test("기본 화면은 흰 바탕 (기기가 다크 모드여도)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/pricing");
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).toBe("rgb(255, 255, 255)");
});

test("마이페이지에서 다크를 고르면 다크", async ({ page }) => {
  await page.goto("/pricing");
  await page.evaluate(() => localStorage.setItem("cv:theme", "dark"));
  await page.reload();
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).not.toBe("rgb(255, 255, 255)");
});

test("요금 안내: 로그인 전에는 결제창 대신 로그인으로", async ({ page }) => {
  await page.goto("/pricing");
  // 결제 키가 없으면 '준비 중', 있으면 '로그인하고 시작하기' — 어느 쪽이든 바로 결제가 열리지 않는다
  await expect(page.getByText(/로그인하고 시작하기|결제 연동 준비 중/).first()).toBeVisible();
});

test("코스 추천: 결과가 나온다", async ({ page }) => {
  await page.goto("/route");
  await page.getByRole("button", { name: "서울역", exact: true }).click();
  await page.getByRole("button", { name: "한산한 코스 만들기" }).click();
  await expect(page.getByText(/곳 코스/).first()).toBeVisible({ timeout: 20_000 });
});

test("홈: 가장 큰 요소 표시 시간(LCP)이 측정된다 (사진 줄 스냅 이동이 측정을 멈추게 했던 것)", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "LCP는 크롬만 지원");
  await page.addInitScript(() => {
    (window as unknown as { __lcp: number }).__lcp = 0;
    new PerformanceObserver((l) => ((window as unknown as { __lcp: number }).__lcp += l.getEntries().length)).observe({
      type: "largest-contentful-paint",
      buffered: true,
    });
  });
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp)).toBeGreaterThan(0);
});
