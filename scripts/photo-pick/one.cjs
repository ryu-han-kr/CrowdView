const { chromium } = require(process.cwd() + "/node_modules/playwright");
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 700 } });
  await p.goto("file:///" + process.argv[2], { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.screenshot({ path: process.argv[3], fullPage: true }); await b.close(); })();
