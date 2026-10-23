// 운영(또는 로컬) 페이지를 휴대폰 크기로 위에서부터 잘라 찍고, 4장씩 한 장으로 묶는다
const fs = require("fs");
const { chromium } = require(process.cwd() + "/node_modules/playwright");
const [, , S, base, tag, ...paths] = process.argv;
(async () => {
  const b = await chromium.launch();
  for (const path of paths) {
    const id = tag + "-" + (path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home");
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await p.goto(base + path, { waitUntil: "networkidle", timeout: 240000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const h = await p.evaluate(() => document.body.scrollHeight);
    const shots = [];
    for (let y = 0, i = 0; y < h && i < 16; y += 780, i++) {
      await p.evaluate((y) => window.scrollTo(0, y), y);
      await p.waitForTimeout(700);
      const f = `${id}-${String(i).padStart(2, "0")}.png`;
      await p.screenshot({ path: `${S}/qa/${f}` });
      shots.push(f);
    }
    await p.close();
    const q = await b.newPage({ viewport: { width: 1640, height: 860 } });
    for (let k = 0; k < shots.length; k += 4) {
      fs.writeFileSync(`${S}/qa/m.html`, `<html><body style="margin:0;display:flex;gap:8px;background:#999">${shots.slice(k, k + 4).map((f) => `<img src="${f}" style="width:400px">`).join("")}</body></html>`);
      await q.goto(`file:///${S}/qa/m.html`); await q.waitForTimeout(400);
      await q.screenshot({ path: `${S}/qa/M-${id}-${k / 4}.png` });
    }
    await q.close();
    console.log(id, shots.length, "slices");
  }
  await b.close();
})();
