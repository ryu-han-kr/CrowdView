// 접근성 자동 검사 (QA 10/21 UX-04·05·12): axe로 주요 화면의 심각(critical)·중대(serious) 문제를 잡는다.
// 글자 대비(color-contrast) 포함: 단계 색 글자는 inkOf(진한 색), 단계 색 칸 위 글자는 deepOf (lib/levels)
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/seoul",
  "/seoul/POI068",
  "/place/lotteworld",
  "/spot/suncheonman",
  "/events",
  "/map",
  "/guide",
  "/near",
  "/route",
  "/airport",
  "/explore",
  "/accuracy",
  "/pricing",
];

for (const path of PAGES) {
  test(`접근성: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    // 실패하면 어떤 규칙이 몇 군데인지, 첫 요소가 무엇인지 보이게
    expect(bad.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}
