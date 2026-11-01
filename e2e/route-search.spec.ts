// 코스 추천 (사용자 10/22): 가고 싶은 곳을 검색해 넣으면 코스에 꼭 들어가고, 자동차·카페도 고를 수 있다.
// 지도 인증이 실패해도(로컬 주소) 화면 전체가 멈추지 않는다
import { expect, test } from "@playwright/test";

test("코스: 검색해서 넣은 곳이 코스에 들어간다 (자동차·카페)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    if (!/accessing a frame with origin/.test(e.message)) errors.push(e.message);
  });
  await page.goto("/route");
  await page.getByRole("button", { name: "명동 관광특구" }).click();
  await page.getByPlaceholder(/장소 이름 검색/).fill("국립중앙");
  await page.getByRole("button", { name: /국립중앙박물관/ }).first().click();
  await expect(page.getByRole("button", { name: /국립중앙박물관 빼기/ })).toBeVisible();
  await page.getByRole("button", { name: "카페", exact: true }).click();
  await page.getByRole("button", { name: "자동차", exact: true }).click();
  // 밤에 돌리면 '오늘·지금' 출발로는 박물관이 문을 닫아 빠진다 (10/23 22시 CI 실패) → 늘 내일 출발로
  await page.getByRole("button", { name: "내일", exact: true }).click();
  await page.getByRole("button", { name: "한산한 코스 만들기" }).click();
  await expect(page.locator("ol").getByText(/국립중앙박물관/).first()).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
