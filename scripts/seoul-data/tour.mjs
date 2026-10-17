// 서울 관광공사 자료(사진 있는 곳) → src/data/seoul/tour.json
// 여행 가이드(Visit Seoul)에 사진이 없어서, 이름·위치가 맞는 관광공사 사진을 붙이고
// 가이드에 없는 관광지·문화시설은 명소로 더한다 (lib/seoul-guide).
// TourAPI KorService2 areaBasedList2 (서울 areaCode=1): 관광지 12 · 문화시설 14 · 레포츠 28 · 쇼핑 38 · 음식점 39. 실행당 호출 약 10건
// 행: [contentid, 종류(12|14|28|38|39), 이름, 위도, 경도, 사진(작은), 사진(큰), 주소]
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

async function page(type, pageNo) {
  const qs = new URLSearchParams({
    serviceKey: KEY,
    pageNo: String(pageNo),
    numOfRows: "1000",
    MobileOS: "ETC",
    MobileApp: "CrowdView",
    _type: "json",
    areaCode: "1",
    contentTypeId: String(type),
    arrange: "Q", // 사진 있는 곳 먼저
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?${qs}`, { signal: AbortSignal.timeout(30_000) });
      const body = (await res.json()).response?.body;
      const items = body?.items?.item;
      return { items: Array.isArray(items) ? items : items ? [items] : [], total: Number(body?.totalCount ?? 0) };
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
}

const https = (u) => String(u ?? "").replace(/^http:/, "https:");
const out = [];
for (const type of [12, 14, 28, 38, 39]) {
  let n = 0;
  for (let p = 1; p <= 5; p++) {
    const { items, total } = await page(type, p);
    for (const i of items) {
      if (!i.firstimage || !Number(i.mapy)) continue;
      out.push([
        String(i.contentid),
        type,
        String(i.title).trim(),
        Math.round(Number(i.mapy) * 1e5) / 1e5,
        Math.round(Number(i.mapx) * 1e5) / 1e5,
        https(i.firstimage2 || i.firstimage),
        https(i.firstimage),
        String(i.addr1 ?? "").trim(),
      ]);
      n++;
    }
    if (p * 1000 >= total || !items.length) break;
  }
  console.log(`종류 ${type}: 사진 있는 곳 ${n}`);
}
fs.writeFileSync(path.join("src", "data", "seoul", "tour.json"), JSON.stringify(out));
console.log(`완료 ${out.length}곳`);
