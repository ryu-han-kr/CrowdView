// 우리 보관본(R2 5분 스냅샷) 하루 요약 crowd_daily(Postgres) → hist/own_crowd_daily.jsonl.gz
import fs from "node:fs";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { WTDIR, HIST } from "./env.mjs";
const require = createRequire(`${WTDIR}/package.json`);
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
const cols = await pool.query("select column_name, data_type from information_schema.columns where table_name='crowd_daily'");
console.log(cols.rows.map((r) => `${r.column_name}:${r.data_type}`).join(" "));
const r = await pool.query("select kind,id,to_char(date,'YYYY-MM-DD') as date,label,samples,avg_score,max_score,max_at,avg_people,max_people,hourly from crowd_daily order by date,kind,id");
const days = new Set(r.rows.map((x) => x.date));
console.log("rows", r.rows.length, "days", days.size, [...days][0], [...days].at(-1), "ids", new Set(r.rows.map((x) => x.kind + x.id)).size);
fs.writeFileSync(`${HIST}/own_crowd_daily.jsonl.gz`, zlib.gzipSync(r.rows.map((x) => JSON.stringify(x)).join("\n")));
const a = await pool.query("select to_char(date,'YYYY-MM-DD') d, snapshots, rows from archive_day order by date");
console.log("archive_day", a.rows.map((x) => `${x.d}:${x.snapshots}`).join(" "));
console.log("sample hourly", JSON.stringify(r.rows.at(-1)?.hourly)?.slice(0, 200));
await pool.end();
