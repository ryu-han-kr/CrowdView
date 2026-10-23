const fs=require("fs"); const { chromium } = require(process.cwd() + "/node_modules/playwright");
const [, , S, out, ...files] = process.argv;
(async () => { const b = await chromium.launch(); const q = await b.newPage({ viewport: { width: 1640, height: 860 } });
  fs.writeFileSync(`${S}/qa/m.html`, `<html><body style="margin:0;display:flex;gap:8px;background:#999">${files.map((f) => `<img src="${f}" style="width:400px">`).join("")}</body></html>`);
  await q.goto(`file:///${S}/qa/m.html`); await q.waitForTimeout(400); await q.screenshot({ path: `${S}/qa/${out}` }); await b.close(); })();
