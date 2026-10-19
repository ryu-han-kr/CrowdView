// 깨진 관광지 사진 주소 고치기: spots.json·seoul/tour.json의 사진(tong.visitkorea.or.kr)이 404면
// TourAPI detailCommon2로 지금 사진 주소를 다시 받는다. 사진이 없어졌으면 그 항목을 뺀다.
// 사용: node scripts/korea-data/fix-images.mjs   (DATA_GO_KR_KEY). 깨진 항목 수만큼 호출 (TourAPI 하루 1,000건 중)
import fs from "node:fs";
import path from "node:path";

if (!process.env.DATA_GO_KR_KEY && fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) {
  console.error("DATA_GO_KR_KEY가 없어요");
  process.exit(1);
}

// 파일별 [사진 열들] (tour.json은 큰 사진·작은 사진 두 열)
const FILES = [
  { file: path.join("src", "data", "korea", "spots.json"), cols: { 6: "firstimage" } },
  { file: path.join("src", "data", "seoul", "tour.json"), cols: { 5: "firstimage", 6: "firstimage2" } },
];

async function alive(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    // 이 서버는 HEAD를 막아 첫 1바이트만 받는다
    const res = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    await res?.body?.cancel().catch(() => {});
    if (res) return res.status === 200 || res.status === 206;
  }
  return true; // 네트워크 오류는 깨진 것으로 보지 않는다
}

async function detail(cid) {
  const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", contentId: cid });
  const res = await fetch(`https://apis.data.go.kr/B551011/KorService2/detailCommon2?${qs}`, { signal: AbortSignal.timeout(20_000) });
  const item = (await res.json()).response?.body?.items?.item;
  return Array.isArray(item) ? item[0] : item;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

let calls = 0;
for (const { file, cols } of FILES) {
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  const first = Number(Object.keys(cols)[0]);
  const broken = [];
  await pool(rows, 16, async (r) => {
    if (typeof r[first] === "string" && !(await alive(r[first]))) broken.push(r);
  });
  let fixed = 0;
  const drop = new Set();
  await pool(broken, 4, async (r) => {
    calls++;
    const d = await detail(String(r[0])).catch(() => null);
    const next = d?.firstimage ? String(d.firstimage).replace(/^http:/, "https:") : "";
    if (next && (await alive(next))) {
      for (const [col, field] of Object.entries(cols)) r[col] = String(d[field] || d.firstimage).replace(/^http:/, "https:");
      fixed++;
    } else drop.add(r);
  });
  const out = rows.filter((r) => !drop.has(r));
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`${file}: 깨짐 ${broken.length} → 고침 ${fixed}, 뺌 ${drop.size} (남은 ${out.length})`);
}
console.log(`TourAPI 호출 ${calls}건`);
