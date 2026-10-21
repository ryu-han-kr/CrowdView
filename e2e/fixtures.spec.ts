// 고정 자료(DATA_FIXTURES=normal)로 띄운 앱에서 화면 사이 값이 같은지 (QA 10/21 SEOUL-S01·MAP-01·HOME-07).
// 자료가 정해져 있어 숫자까지 비교한다. 고정 자료 모드가 아니거나 운영 주소로 돌릴 때는 건너뛴다
import { expect, test, type Page } from "@playwright/test";

test.skip(process.env.DATA_FIXTURES !== "normal" || !!process.env.E2E_BASE_URL, "DATA_FIXTURES=normal 빌드에서만");

/** 서울 실시간 목록 카드의 id → 단계 */
async function seoulListLevels(page: Page) {
  await page.goto("/seoul");
  const cards = page.locator('a[data-place-id^="seoul-"]').filter({ visible: true });
  await expect(cards.first()).toBeVisible();
  return Object.fromEntries(
    await cards.evaluateAll((as) => as.map((a) => [a.getAttribute("data-place-id")!, a.getAttribute("data-level")!] as const)),
  ) as Record<string, string>;
}

test("SEOUL-S01: 성수카페거리 — 목록·상세가 같은 단계·인원 (고정 자료 붐빔 3만~3.2만)", async ({ page }) => {
  const list = await seoulListLevels(page);
  expect(list["seoul-POI068"]).toBe("5"); // 서울시 '붐빔' → 우리 5단계 '매우 혼잡'
  await expect(page.locator('a[data-place-id="seoul-POI068"]').filter({ visible: true }).first()).toContainText("3만~3.2만");
  await page.goto("/seoul/POI068");
  await expect(page.getByText("3만~3.2만명").first()).toBeVisible();
  await expect(page.getByText("붐빔").first()).toBeVisible();
});

test("MAP-01: 지도 '서울 실시간' 핀과 서울 목록이 같은 곳·같은 단계", async ({ page }) => {
  const list = await seoulListLevels(page);
  await page.goto("/map");
  await page.getByRole("button", { name: /서울 실시간/ }).click();
  const pins = page.locator('[data-testid="spot-map"] [data-place-id]');
  // 지도는 다시 그려질 수 있어(네이버 지도 → 키가 없으면 그림 지도) 핀 수가 목록 수와 같아질 때까지 기다린다
  await expect.poll(() => pins.count(), { timeout: 20_000 }).toBe(Object.keys(list).length);
  const map = Object.fromEntries(
    await pins.evaluateAll((els) => els.map((e) => [e.getAttribute("data-place-id")!, e.getAttribute("data-level")!] as const)),
  ) as Record<string, string>;
  expect(Object.keys(map).sort()).toEqual(Object.keys(list).sort());
  for (const id of Object.keys(list)) expect(map[id], id).toBe(list[id]);
  // 핀을 누르면 같은 곳 카드가 뜬다
  await pins.filter({ has: page.locator("xpath=self::*[@data-place-id='seoul-POI068']") }).first().dispatchEvent("click");
  await expect(page.locator('[data-selected-id="seoul-POI068"]')).toBeVisible();
});

test("HOME-07: 검색어가 주소에 남아 상세 → 뒤로 가기 후에도 그대로", async ({ page }) => {
  await page.goto("/seoul");
  const box = page.getByPlaceholder("지역 이름 검색 (예: 성수, 한강)").filter({ visible: true }).first();
  await box.fill("성수");
  await expect(page).toHaveURL(/[?&]q=%EC%84%B1%EC%88%98/);
  await page.locator('a[data-place-id="seoul-POI068"]').filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/seoul\/POI068/, { timeout: 30_000 });
  await page.goBack();
  await expect(page.getByPlaceholder("지역 이름 검색 (예: 성수, 한강)").filter({ visible: true }).first()).toHaveValue("성수");
  await page.reload();
  await expect(page.getByPlaceholder("지역 이름 검색 (예: 성수, 한강)").filter({ visible: true }).first()).toHaveValue("성수");
});
