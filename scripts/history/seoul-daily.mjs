// 서울 열린데이터 날짜별 수집 → hist/<out>.jsonl (한 줄 = 하루 {d, rows}). 이어받기 가능
// node seoul-daily.mjs SVC FROM(YYYYMMDD) TO OUT [m]  (m: 월 단위 YYYYMM)
import fs from "node:fs";
import { get, seoul, sleep, HIST, redact } from "./env.mjs";
const [svc, from, to, out, unit] = process.argv.slice(2);
const file = `${HIST}/${out}.jsonl`;
const done = new Set();
if (fs.existsSync(file)) for (const l of fs.readFileSync(file, "utf8").split("\n")) if (l) done.add(JSON.parse(l).d);

const PICK = {
  SPOP_LOCAL_RESD_JACHI: (r) => [r.ADSTRD_CODE_SE, +r.TMZON_PD_SE, +(+r.TOT_LVPOP_CO).toFixed(0)],
  SPOP_LOCAL_RESD_DONG: (r) => [r.ADSTRD_CODE_SE, +r.TMZON_PD_SE, +(+r.TOT_LVPOP_CO).toFixed(0)],
  SPOP_FORN_TEMP_RESD_DONG: (r) => [r.ADSTRD_CODE_SE, +r.TMZON_PD_SE, +(+r.TOT_LVPOP_CO).toFixed(1)],
  SPOP_FORN_LONG_RESD_DONG: (r) => [r.ADSTRD_CODE_SE, +r.TMZON_PD_SE, +(+r.TOT_LVPOP_CO).toFixed(1)],
  CardSubwayStatsNew: (r) => [r.SBWY_ROUT_LN_NM, r.SBWY_STNS_NM, +r.GTON_TNOPE, +r.GTOFF_TNOPE],
  CardSubwayTime: (r) => [r.SBWY_ROUT_LN_NM, r.STTN, ...Array.from({ length: 24 }, (_, h) => [+(r[`HR_${h}_GET_ON_NOPE`] ?? 0), +(r[`HR_${h}_GET_OFF_NOPE`] ?? 0)]).flat()], // 인덱스 = 시(0~23)
};

function* dates() {
  if (unit === "m") {
    let y = +from.slice(0, 4), m = +from.slice(4, 6);
    while (`${y}${String(m).padStart(2, "0")}` <= to) {
      yield `${y}${String(m).padStart(2, "0")}`;
      if (++m > 12) (m = 1), y++;
    }
    return;
  }
  const d = new Date(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6)}T00:00:00Z`);
  const end = `${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6)}`;
  while (d.toISOString().slice(0, 10) <= end) {
    yield d.toISOString().slice(0, 10).replaceAll("-", "");
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

async function fetchDay(d) {
  const rows = [];
  for (let start = 1; ; start += 1000) {
    const r = await get(seoul(svc, start, start + 999, d));
    let j;
    try { j = JSON.parse(r.text); } catch { throw new Error(`non-json ${d}: ${redact(r.text.slice(0, 200))}`); }
    const body = j[svc];
    if (!body) {
      if (j.RESULT?.CODE === "INFO-200") return rows;
      throw new Error(`${d}: ${JSON.stringify(j.RESULT)}`);
    }
    rows.push(...body.row.map(PICK[svc]));
    if (start + 999 >= body.list_total_count) return rows;
    await sleep(150);
  }
}

const todo = [...dates()].filter((d) => !done.has(d));
console.log(svc, "todo", todo.length, "done", done.size);
let n = 0, calls = 0;
const CONC = 3;
let idx = 0;
async function worker() {
  while (idx < todo.length) {
    const d = todo[idx++];
    try {
      const rows = await fetchDay(d);
      calls++;
      if (rows.length) fs.appendFileSync(file, JSON.stringify({ d, rows }) + "\n");
      else fs.appendFileSync(file, JSON.stringify({ d, rows: [] }) + "\n");
      if (++n % 50 === 0) console.log(svc, n, "/", todo.length, d, rows.length);
    } catch (e) {
      console.log("ERR", d, redact(e.message));
      await sleep(5000);
    }
    await sleep(250);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log(svc, "finished", n);
