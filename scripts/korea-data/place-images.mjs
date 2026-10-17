// 우리 장소(lib/places.ts)마다 관광공사 사진 여러 장 → src/data/korea/place-images.json ({ [장소 id]: [큰 사진 url, …] })
// 장소 상세 위 사진을 넘겨 볼 수 있게. TourAPI KorService2 detailImage2 (ktoContent가 있는 장소만), 실행당 호출 약 20건
// 공항·이름이 없는 곳은 관광공사 키워드 검색(searchKeyword2) 첫 결과의 사진들
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

async function call(op, params) {
  const qs = new URLSearchParams({
    serviceKey: KEY,
    MobileOS: "ETC",
    MobileApp: "CrowdView",
    _type: "json",
    numOfRows: "20",
    pageNo: "1",
    ...params,
  });
  const res = await fetch(`https://apis.data.go.kr/B551011/KorService2/${op}?${qs}`, { signal: AbortSignal.timeout(15_000) });
  const items = (await res.json()).response?.body?.items?.item;
  return Array.isArray(items) ? items : items ? [items] : [];
}

// places.ts에서 id·이름·ktoContent만 글자로 읽는다 (TS를 실행하지 않으려고)
const src = fs.readFileSync(path.join("src", "lib", "places.ts"), "utf8");
const places = [...src.matchAll(/id: "([^"]+)",[\s\S]*?name: "([^"]+)"[\s\S]*?(?:ktoContent: \{ id: (\d+)|\n  \},)/g)].map((m) => ({
  id: m[1],
  name: m[2],
  cid: m[3],
}));
// 키워드로 찾을 때 쓸 이름 (공항 등)
const KEYWORD = {
  "icn-t1": "인천국제공항",
  "icn-t2": "인천국제공항",
  gimpo: "김포국제공항",
  "jeju-airport": "제주국제공항",
  gimhae: "김해국제공항",
  hongdae: "홍대 걷고싶은거리",
};

const out = {};
for (const p of places) {
  let cid = p.cid;
  if (!cid) {
    const q = KEYWORD[p.id] ?? p.name;
    const [hit] = (await call("searchKeyword2", { keyword: q })).filter((r) => r.firstimage);
    cid = hit?.contentid;
  }
  if (!cid) continue;
  const imgs = (await call("detailImage2", { contentId: String(cid), imageYN: "Y" }))
    .map((i) => String(i.originimgurl ?? "").replace(/^http:/, "https:"))
    .filter((u) => u.startsWith("https://tong.visitkorea.or.kr/"));
  if (imgs.length) out[p.id] = imgs.slice(0, 8);
  console.log(`${p.name}: ${imgs.length}장`);
}
fs.writeFileSync(path.join("src", "data", "korea", "place-images.json"), JSON.stringify(out));
console.log(`완료 ${Object.keys(out).length}/${places.length}곳`);
