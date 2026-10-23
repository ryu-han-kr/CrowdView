const fs = require("fs");
const { chromium } = require(process.cwd() + "/node_modules/playwright");
const S = process.argv[2];
const cand = JSON.parse(fs.readFileSync(`${S}/cand/cand.json`, "utf8"));
const ids = Object.keys(cand).filter((id) => cand[id].c.length > 0);
const per = 7;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 900 } });
  let n = 0;
  for (let i = 0; i < ids.length; i += per) {
    const rows = ids.slice(i, i + per).map((id) => {
      const x = cand[id];
      const cells = [["현재", x.cur], ...x.c.map((c, j) => [String(j + 1), c.src])]
        .map(([l, src]) => `<div class="c ${l === "현재" ? "cur" : ""}"><img src="${src}" loading="eager"><b>${l}</b></div>`).join("");
      return `<div class="r"><div class="n">${x.name}<br><small>${id}</small></div>${cells}</div>`;
    }).join("");
    await p.setContent(`<html><head><meta charset="utf-8"><style>body{margin:6px;font:12px 'Malgun Gothic'}.r{display:flex;gap:4px;margin-bottom:6px;align-items:flex-start}.n{width:90px;font-weight:700}.c{position:relative;width:104px;height:78px}.c img{width:104px;height:78px;object-fit:cover;border-radius:4px}.c b{position:absolute;left:2px;top:2px;background:#000c;color:#fff;padding:0 4px;border-radius:3px;font-size:13px}.cur img{outline:3px solid red}</style></head><body>${rows}</body></html>`);
    await p.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const h = await p.evaluate(() => document.body.scrollHeight);
    await p.setViewportSize({ width: 1700, height: h + 12 });
    await p.screenshot({ path: `${S}/cand/sheet-${String(n).padStart(2, "0")}.png` });
    n++;
  }
  console.log("sheets", n, "entities", ids.length);
  await b.close();
})();
