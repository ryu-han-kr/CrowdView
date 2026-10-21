// QA 명세(10/21) 핵심 흐름: 보안 헤더, 서울 검색 → 상세, 위치 권한 거부 후 직접 고르기, 가이드 중복 카드.
// CI에는 비밀 키가 없어 숫자(인원·단계)는 매번 달라질 수 있으므로 개수 대신 장소 id·주소로 확인한다
import { expect, test } from "@playwright/test";

test("보안 헤더: 남의 사이트 틀 안에 못 넣고, 파일 종류 추측 막기", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("SAMEORIGIN");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("SEOUL-S01: 서울 실시간에서 '성수' 검색 → 성수카페거리 상세", async ({ page }) => {
  await page.goto("/seoul");
  // 휴대폰·PC 검색창이 따로 있어 보이는 쪽을 쓴다
  await page.getByPlaceholder("지역 이름 검색 (예: 성수, 한강)").filter({ visible: true }).first().fill("성수");
  const link = page.locator('a[href$="/seoul/POI068"]').filter({ visible: true }).first();
  await expect(link).toBeVisible();
  // 검색 결과에 성수와 상관없는 곳이 섞이지 않는다
  const visibleAreas = () =>
    page
      .locator('a[href*="/seoul/POI"]')
      .filter({ visible: true })
      .evaluateAll((as) => new Set(as.map((a) => a.getAttribute("href"))).size);
  // 검색 결과가 걸러질 때까지 기다린다 (느린 기기에서는 입력 직후 아직 전체 목록)
  await expect.poll(visibleAreas, { timeout: 10_000 }).toBeLessThan(10);
  await link.click();
  // 상세는 처음 그릴 때 서울시 자료를 받아 오느라 느릴 수 있다
  await expect(page).toHaveURL(/\/seoul\/POI068/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("성수카페거리");
});

test("NEAR-S01: 위치 권한을 거부해도 안내가 나오고, 장소를 직접 골라 찾을 수 있다", async ({ page }) => {
  // 브라우저마다 거부 방식이 달라서, 거부(코드 1)를 바로 돌려주게 고정한다
  await page.addInitScript(() => {
    const deny = (_ok: unknown, fail?: (e: { code: number; message: string }) => void) => fail?.({ code: 1, message: "denied" });
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: deny, watchPosition: deny, clearWatch() {} } });
  });
  await page.goto("/near");
  await page.getByRole("button", { name: /내 위치 사용하기/ }).click();
  await expect(page.getByText("위치를 쓸 수 없어요")).toBeVisible();
  // 임의의 현재 위치를 지어내지 않는다
  await expect(page.getByRole("button", { name: /내 위치 기준/ })).toHaveCount(0);
  // 위에 있는 장소 칩 하나를 고르면 결과가 나온다
  await page.getByRole("button", { name: "서울역" }).first().click();
  await expect(page.getByText("내 위치를 켜거나 위에서 장소를 고르면")).toHaveCount(0);
});

test("EXP-03: 서울 여행 가이드에 같은 장소 카드가 두 번 나오지 않는다", async ({ page }) => {
  await page.goto("/guide");
  const hrefs = await page.locator('main a[href*="/guide/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const cards = hrefs.filter((h) => h && /\/guide\/[^/?#]+$/.test(h));
  expect(cards.length).toBeGreaterThan(0);
  expect(new Set(cards).size).toBe(cards.length);
});

test("EXP-S02: 가이드 자료를 못 받으면 '0곳'이 아니라 불러오기 실패 안내", async ({ page }) => {
  await page.route(/\/data\/guide-[a-zA-Z-]+\.json/, (r) => r.fulfill({ status: 500, body: "x" }));
  await page.goto("/guide");
  // 명소는 서버가 먼저 넣어 주므로 보이고, 실패 안내가 함께 나온다
  await expect(page.getByText("데이터를 불러오지 못했어요").first()).toBeVisible();
  // 서버가 넣어 주지 않는 맛집을 고르면 '0곳' 대신 실패 안내
  // 휴대폰은 칩 버튼, PC는 왼쪽 체크박스
  await page.getByRole("button", { name: /맛집/ }).or(page.getByRole("checkbox", { name: /맛집/ })).filter({ visible: true }).first().click();
  await expect(page.getByText("데이터를 불러오지 못했어요").first()).toBeVisible();
  await expect(page.getByText(/^0곳$/)).toHaveCount(0);
});
