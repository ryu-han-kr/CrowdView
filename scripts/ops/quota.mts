// 운영 Redis의 API 사용량 집계와 비용 리포트를 로컬에서 본다 (디스코드 9시 리포트와 같은 값). 키 값은 출력하지 않는다
// npx tsx scripts/ops/quota.mts [날짜 수=5] — API 사용량 + 이용 집계(순방문자·페이지뷰·기대수익)
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

// 이용 집계 (관리자 화면 '이용·기대수익' 표와 같은 값)
const { getTraffic } = await import("../../src/lib/traffic.ts");
const { dayRevenue } = await import("../../src/lib/revenue.ts");
console.log(`\n날짜 | 순방문자 | 방문 | 페이지뷰 | 기대수익(광고+제휴) | 1인당 | 잠재 제휴`);
for (const d of (await getTraffic(days.length)).reverse()) {
  const r = dayRevenue(d);
  console.log(`${d.date.slice(5)} | ${d.uv} | ${d.sessions} | ${d.pv} | ${r.total.toFixed(1)}원 (${r.ads.toFixed(1)}+${r.affiliate.toFixed(1)}) | ${r.perUser.toFixed(1)}원 | ${r.affiliatePotential.toFixed(1)}원`);
}

// 들어온 페이지별 '다음 페이지로 넘어간 비율' (10/26부터 집계)
const sum: Record<string, [number, number]> = {};
for (const d of await getTraffic(days.length))
  for (const [k, n] of Object.entries(d.f)) {
    const m = k.match(/^(land|deep):(.+)$/);
    if (m) (sum[m[2]] ??= [0, 0])[m[1] === "land" ? 0 : 1] += n;
  }
if (Object.keys(sum).length) {
  console.log(`\n들어온 페이지 | 방문 | 다음 페이지로 | 비율`);
  for (const [p, [land, deep]] of Object.entries(sum).sort((a, b) => b[1][0] - a[1][0]))
    console.log(`${p} | ${land} | ${deep} | ${land ? Math.round((deep / land) * 100) : 0}%`);
}
