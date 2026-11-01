import { expect, test } from "@playwright/test";

// 경수님 QA 11/1: 더 보기로 늘린 목록에서 장소를 눌렀다가 뒤로 오면 처음으로 돌아가던 문제
for (const { path, card } of [
  { path: "/seoul", card: 'a[href^="/seoul/"]' },
  { path: "/guide", card: 'a[href^="/guide/"]' },
]) {
  test(`${path}: 더 보기 → 상세 → 뒤로 오면 펼친 수·자리 유지, 새로 들어오면 처음부터`, async ({ page }) => {
    await page.goto(path);
    const more = page.getByRole("button", { name: /더 보기/ }).first();
    await more.scrollIntoViewIfNeeded();
    const first = await page.locator(card).count();
    await more.click();
    await expect.poll(() => page.locator(card).count()).toBeGreaterThan(first);
    const opened = await page.locator(card).count();

    const target = page.locator(card).nth(opened - 2);
    await target.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(300);
    await target.click();
    await expect(page).not.toHaveURL(new RegExp(`${path}$`));

    await page.goBack();
    await expect.poll(() => page.locator(card).count(), { timeout: 15_000 }).toBe(opened);
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 15_000 }).toBeGreaterThan(y - 60);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(y + 60);

    await page.goto("/about");
    await page.goto(path);
    await expect.poll(() => page.locator(card).count()).toBeLessThan(opened);
  });
}

test("캐릭터: 층이 다 불러와지고 깨진 그림이 없다", async ({ page }) => {
  await page.goto("/spot/jirisan");
  const stack = page.locator(".mascot-stack").first();
  // 늘 움직이는 그림이라 Playwright의 '멈출 때까지 기다리기'를 쓰면 시간이 초과된다
  await stack.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await expect(stack.locator("img.mascot-body")).toBeVisible();
  const broken = await page.$$eval(".mascot-stack img", (els) => els.filter((e) => (e as HTMLImageElement).complete && !(e as HTMLImageElement).naturalWidth).length);
  expect(broken).toBe(0);
});

test("국립공원 화면에만 대피소 예약 바로 가기", async ({ page }) => {
  await page.goto("/spot/jirisan");
  await expect(page.getByRole("link", { name: /대피소 예약하러 가기/ })).toHaveAttribute("href", /reservation\.knps\.or\.kr\/reservation\/shelter/);
  await page.goto("/spot/gyeongbokgung");
  await expect(page.getByRole("link", { name: /대피소 예약하러 가기/ })).toHaveCount(0);
});
