// 관광공사 데이터랩 기초지자체(시군구)·광역 일별 방문자 수 백필 → hist/datalab_{locgo|metco}.jsonl (한 줄 = 한 달 {m, rows:[[code, ymd, tou, num]]})
// 운영 한도(하루 1,000회) 집계 키에도 같이 올린다. MAXCALLS 넘으면 멈춤
import fs from "node:fs";
import { get, dg, redact, kvIncr, kvGet, kstDate, sleep, HIST } from "./env.mjs";
const op = process.argv[2] ?? "locgoRegnVisitrDDList";
const from = process.argv[3] ?? "202201", to = process.argv[4] ?? "202610";
const MAXCALLS = Number(process.argv[5] ?? 300);
const PAGE = Number(process.argv[6] ?? 10000);
const file = `${HIST}/datalab_${op.startsWith("locgo") ? "locgo" : "metco"}.jsonl`;
const done = new Set();
if (fs.existsSync(file)) for (const l of fs.readFileSync(file, "utf8").split("\n")) if (l) done.add(JSON.parse(l).m);
const used = Number((await kvGet(`quota:${kstDate()}:kto-datalab`)) ?? 0);
console.log("quota used today", used);
if (used > 500) process.exit(0);
let calls = 0;
const months = [];
for (let y = +from.slice(0, 4), m = +from.slice(4); `${y}${String(m).padStart(2, "0")}` <= to; m === 12 ? (y++, (m = 1)) : m++) months.push(`${y}${String(m).padStart(2, "0")}`);
for (const ym of months) {
  if (done.has(ym)) continue;
  const last = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(4), 0)).getUTCDate();
  const rows = [];
  let total = Infinity;
  for (let page = 1; (page - 1) * PAGE < total; page++) {
    if (calls >= MAXCALLS) { console.log("call cap"); process.exit(0); }
    const r = await get(dg(`/B551011/DataLabService/${op}`, { startYmd: `${ym}01`, endYmd: `${ym}${last}`, numOfRows: String(PAGE), pageNo: String(page), MobileOS: "WEB", MobileApp: "CrowdView", _type: "json" }), 3, 120000);
    calls++;
    await kvIncr(`quota:${kstDate()}:kto-datalab`);
    let j;
    try { j = JSON.parse(r.text); } catch { console.log("bad", ym, page, redact(r.text.slice(0, 300))); process.exit(1); }
    const body = j.response?.body;
    if (!body) { console.log("err", ym, redact(r.text.slice(0, 300))); process.exit(1); }
    total = Number(body.totalCount ?? 0);
    const it = body.items?.item ?? [];
    for (const x of Array.isArray(it) ? it : [it]) rows.push([x.signguCode ?? x.areaCode, x.baseYmd, +x.touDivCd, Math.round(+x.touNum)]);
    if (!it || (Array.isArray(it) && it.length === 0)) break;
    await sleep(300);
  }
  console.log(ym, "rows", rows.length, "total", total, "calls", calls);
  if (rows.length) fs.appendFileSync(file, JSON.stringify({ m: ym, rows }) + "\n");
  else if (ym < "202608") fs.appendFileSync(file, JSON.stringify({ m: ym, rows }) + "\n");
}
console.log("done calls", calls);
