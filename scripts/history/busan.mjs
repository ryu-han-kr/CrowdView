// 부산 행정동 생활인구(월별 시간대 평균) 전체 이력 → hist/busan_dong_time.json
import fs from "node:fs";
import { get, dg, redact, kvIncr, kstDate, sleep, HIST } from "./env.mjs";
const ent = JSON.parse(fs.readFileSync(`${HIST}/entities.json`, "utf8"));
const dongs = [...new Set(ent.places.flatMap((p) => p.busanDongs ?? []))];
console.log("dongs", dongs.length, dongs.join(","));
const out = {};
for (const d of dongs) {
  const r = await get(dg("/6260000/DongPopTimeService/getDongPopTime", { hname: d, numOfRows: "5000", resultType: "json" }), 2, 60000);
  await kvIncr(`quota:${kstDate()}:busan-pop`);
  try {
    const j = JSON.parse(r.text);
    const it = j.response?.body?.items?.item ?? [];
    out[d] = {};
    for (const x of Array.isArray(it) ? it : [it]) {
      const h = parseInt(x.times, 10);
      (out[d][x.stdYm] ??= Array(24).fill(0))[h] = +x.vpopAvg;
    }
    console.log(d, Object.keys(out[d]).length, "months", Object.keys(out[d]).sort()[0], Object.keys(out[d]).sort().at(-1));
  } catch {
    console.log("bad", d, redact(r.text.slice(0, 200)));
  }
  await sleep(300);
}
fs.writeFileSync(`${HIST}/busan_dong_time.json`, JSON.stringify(out));
