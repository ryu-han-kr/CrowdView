// 주요 화면이 열리고(200), 제목이 보이고, 화면이 옆으로 넘치지 않고, 브라우저 오류가 없는지
import { expect, test, type Page } from "@playwright/test";

const PAGES: [path: string, heading: RegExp][] = [
  ["/", /한산할까/],
  ["/map", /혼잡도 지도/],
  ["/explore", /지역 여행/],
  ["/guide", /서울 여행 가이드/],
  ["/route", /한산한 코스/],
  ["/seoul", /서울 실시간/],
  ["/place/gyeongbokgung", /경복궁/],
  ["/spot/haeundae", /해운대/],
  ["/events", /축제/],
  ["/airport", /공항/],
  ["/pricing", /Plus|요금/],
  ["/me", /마이|내 정보|로그인/],
  ["/en", /quiet/i],
];

/** 우리 코드에서 난 오류만 (광고·지도·외부 스크립트 경고는 뺀다) */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/googlesyndication|adsbygoogle|naver|map\.|Failed to load resource|favicon|net::ERR/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

for (const [path, heading] of PAGES) {
  test(`${path} 열림`, async ({ page }) => {
    const errors = collectErrors(page);
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status(), "응답 코드").toBe(200);
    await expect(page.locator("main h1").first()).toHaveText(heading);
    // 화면이 옆으로 넘치면(가로 스크롤) 휴대폰에서 깨져 보인다
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "가로로 넘친 픽셀").toBeLessThanOrEqual(1);
    await page.waitForLoadState("load");
    expect(errors, "브라우저 오류").toEqual([]);
  });
}
