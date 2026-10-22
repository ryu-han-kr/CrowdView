// 디자인 전·후 비교용 화면 사진 (시험이 아니라 사진만 찍는다). `npm run e2e:screens` → test-results/screens/<기기>/<화면>.png
// 실시간 숫자·자동으로 넘어가는 배너 때문에 매번 조금씩 달라서, 자동 비교 대신 사람이 보는 용도
import { test } from "@playwright/test";

const SCREENS: [name: string, path: string][] = [
  ["home", "/"],
  ["place", "/place/gyeongbokgung"],
  ["place-seongsu", "/place/seongsu"],
  ["place-everland", "/place/everland"],
  ["map", "/map"],
  ["seoul", "/seoul"],
  ["route", "/route"],
  ["me", "/me"],
  ["pricing", "/pricing"],
  ["guide", "/guide"],
];

test.describe("@screens", () => {
  for (const [name, path] of SCREENS) {
    test(name, async ({ page }, info) => {
      await page.goto(path, { waitUntil: "load" });
      // 배너 자동 넘김·애니메이션 멈춤
      await page.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `test-results/screens/${info.project.name}/${name}.png`, fullPage: true });
    });
  }
});
