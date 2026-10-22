// 전문 사진가가 찍은 관광공사 '관광사진 갤러리' 사진 모으기 (사용자 10/22: 자연스러운 일반 사진 말고 각 잡고 찍은 사진).
// 한국관광공사_관광사진 정보(PhotoGalleryService1) — 공공누리 제1유형(출처 표시). data.go.kr 활용신청이 필요하다.
//   결과: src/data/korea/pro-photos.json ({ [장소 id]: [{ src, title, photographer, month }] }) — lib/place-photos가 맨 앞에 쓴다
// 실행: npx tsx scripts/korea-data/pro-photos.mts   (DATA_GO_KR_KEY, 장소당 1~2건)
//       ONLY=everland,lotteworld 처럼 주면 그 곳만 다시
import fs from "node:fs";
import { PLACES } from "../../src/lib/places.ts";

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
const OUT = "src/data/korea/pro-photos.json";
const MAX = 6;
type Item = Record<string, string>;

async function search(keyword: string): Promise<Item[] | "denied"> {
  const qs = new URLSearchParams({ serviceKey: KEY!, MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", numOfRows: "40", pageNo: "1", arrange: "A", keyword });
  const res = await fetch(`https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1?${qs}`, { signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  if (/SERVICE_KEY_IS_NOT_REGISTERED|등록되지 않은/.test(text)) return "denied";
  try {
    const items = JSON.parse(text).response?.body?.items?.item;
    return Array.isArray(items) ? items : items ? [items] : [];
  } catch {
    return [];
  }
}

// 이름 검색어: 괄호·'어드벤처' 같은 꼬리를 떼고, 짧은 이름도 한 번 더
const keywordsOf = (name: string) => {
  const base = name.replace(/\(.*?\)/g, "").trim();
  const short = base.replace(/\s*(어드벤처|스키장|해수욕장|카페거리|걷고싶은거리|국내선|제1터미널|제2터미널)$/, "");
  return [...new Set([base, short])];
};

const prev: Record<string, unknown[]> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const only = (process.env.ONLY ?? "").split(",").filter(Boolean);
const out: Record<string, unknown[]> = { ...prev };
for (const p of PLACES) {
  if (only.length && !only.includes(p.id)) continue;
  const seen = new Set<string>();
  const list: { src: string; title: string; photographer: string; month: string }[] = [];
  for (const kw of keywordsOf(p.name)) {
    const items = await search(kw);
    if (items === "denied") {
      console.error("관광사진 정보 API 활용신청이 안 되어 있어요 (data.go.kr '한국관광공사_관광사진 정보')");
      process.exit(2);
    }
    for (const it of items) {
      const src = String(it.galWebImageUrl ?? "").replace(/^http:/, "https:");
      if (!src || seen.has(src)) continue;
      // 제목이나 검색 키워드에 장소 이름이 들어 있는 사진만 (다른 곳 사진이 섞이지 않게)
      const hay = `${it.galTitle ?? ""} ${it.galSearchKeyword ?? ""} ${it.galPhotographyLocation ?? ""}`;
      if (!keywordsOf(p.name).some((k) => hay.replace(/\s/g, "").includes(k.replace(/\s/g, "")))) continue;
      seen.add(src);
      list.push({ src, title: String(it.galTitle ?? ""), photographer: String(it.galPhotographer ?? "한국관광공사"), month: String(it.galPhotographyMonth ?? "") });
    }
    if (list.length >= MAX) break;
  }
  // 최근에 찍은 것부터
  list.sort((a, b) => b.month.localeCompare(a.month));
  if (list.length) out[p.id] = list.slice(0, MAX);
  console.log(`${p.name}: ${list.length}장`);
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`→ ${OUT}`);
