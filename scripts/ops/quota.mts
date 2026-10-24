// 운영 Redis의 API 사용량 집계와 비용 리포트를 로컬에서 본다 (디스코드 9시 리포트와 같은 값). 키 값은 출력하지 않는다
// npx tsx scripts/ops/quota.mts [날짜 수=5]
import fs from "node:fs";
for (const line of fs.readFileSync(process.cwd() + "/.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.KV_FORCE = "1"; // 로컬에서도 운영 Redis를 읽는다 (lib/cache)
const { kv } = await import("../../src/lib/cache.ts");
const { APIS } = await import("../../src/lib/api-quota.ts");
const { buildCostReport, reportSummary } = await import("../../src/lib/billing/report.ts");
const { addDays, kst } = await import("../../src/lib/time.ts");

console.log(reportSummary(await buildCostReport()));
const days = Array.from({ length: Number(process.argv[2] ?? 5) }, (_, i) => addDays(kst().date, -i)).reverse();
const rows = await Promise.all(APIS.map(async (a) => [a, await kv.mget(days.map((d) => `quota:${d}:${a.id}`))] as const));
console.log(`\nAPI | ${days.map((d) => d.slice(5)).join(" | ")} | 하루 한도`);
for (const [a, v] of rows) if (v.some(Boolean)) console.log(`${a.id} | ${v.map((x) => x ?? 0).join(" | ")} | ${a.limit ?? "-"}`);
