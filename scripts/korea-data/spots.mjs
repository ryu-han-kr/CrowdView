// 지역별 명소 디렉터리 → src/data/korea/spots.json (계획서 2단계)
// 한국관광공사 TourAPI areaBasedList2: 시도마다 관광지(12)·문화시설(14)·레포츠(28)를 사진 있는 최근 갱신 순으로 60곳씩.
// 직접 고른 대표 명소(landmarks.json)는 빼고, 이름은 한국어만 (외국어 TourAPI는 활용신청 전).
// 사용: node scripts/korea-data/spots.mjs   (DATA_GO_KR_KEY). 실행당 호출 51건 (TourAPI 하루 1,000건 중)
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

// TourAPI 지역 코드 → 화면의 지역 칩 (lib/korea REGIONS)
const AREAS = {
  1: "서울", 2: "인천", 3: "대전", 4: "대구", 5: "광주", 6: "부산", 7: "울산", 8: "세종",
  31: "경기", 32: "강원", 33: "충북", 34: "충남", 35: "경북", 36: "경남", 37: "전북", 38: "전남", 39: "제주",
};
const TYPES = { 12: "attraction", 14: "culture", 28: "leisure" };
const PER = 60;
// 여행지로 보기 어려운 곳
const SKIP = /도서관|수련원|연수원|교육원|주민센터|협회|사무소|청사$|센터\(|골프장|사격장|당구|볼링|헬스|피트니스|낚시터|PC방/;

async function list(area, type) {
  const qs = new URLSearchParams({
    serviceKey: KEY, pageNo: "1", numOfRows: String(PER), MobileOS: "ETC", MobileApp: "CrowdView", _type: "json",
    areaCode: String(area), contentTypeId: String(type), arrange: "Q",
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?${qs}`, { signal: AbortSignal.timeout(20_000) });
      const items = (await res.json()).response?.body?.items?.item;
      return Array.isArray(items) ? items : items ? [items] : [];
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
}

const curated = new Set(
  JSON.parse(fs.readFileSync(path.join("src", "data", "korea", "landmarks.json"), "utf8")).map((l) => l.cid),
);
const out = [];
const seen = new Set();
for (const [area, region] of Object.entries(AREAS)) {
  for (const [type, kind] of Object.entries(TYPES)) {
    const rows = await list(area, type);
    for (const r of rows) {
      const cid = String(r.contentid);
      const lat = Number(r.mapy);
      const lng = Number(r.mapx);
      const name = String(r.title ?? "").trim();
      if (!r.firstimage || !(lat > 33) || !name || SKIP.test(name) || curated.has(cid) || seen.has(cid)) continue;
      seen.add(cid);
      // [contentid, 종류, 지역, 이름, 위도, 경도, 작은 사진, 시군구]
      out.push([
        cid,
        kind,
        region,
        name,
        Math.round(lat * 1e5) / 1e5,
        Math.round(lng * 1e5) / 1e5,
        String(r.firstimage2 || r.firstimage).replace(/^http:/, "https:"),
        String(r.addr1 ?? "").split(" ")[1] ?? "",
      ]);
    }
  }
  console.log(`${region}: ${out.filter((s) => s[2] === region).length}`);
}
const file = path.join("src", "data", "korea", "spots.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log(`완료 ${out.length}곳, ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
