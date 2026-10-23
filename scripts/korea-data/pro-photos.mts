// 전문 사진가가 찍은 관광공사 '관광사진 갤러리' 사진 모으기 (사용자 10/22: 자연스러운 일반 사진 말고 각 잡고 찍은 사진).
// 한국관광공사_관광사진 정보(PhotoGalleryService1) — 공공누리 제1유형(출처 표시). data.go.kr 활용신청이 필요하다.
//   결과: src/data/korea/pro-photos.json ({ [장소 id]: [{ src, w, h, title, photographer, month }] }) — lib/place-photos가 맨 앞에 쓴다
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

// 사진 앞부분만 받아 JPEG 크기를 읽는다. 없는 사진(404·html)은 null
async function probe(src: string): Promise<{ w: number; h: number } | null> {
  try {
    const res = await fetch(src, { headers: { Range: "bytes=0-65535" }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const b = Buffer.from(await res.arrayBuffer());
    for (let i = 2; i < b.length - 9; ) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  } catch {
    return null;
  }
}

// 이름 검색어: 괄호·'어드벤처' 같은 꼬리를 떼고, 짧은 이름도 한 번 더
const keywordsOf = (name: string) => {
  const base = name.replace(/\(.*?\)/g, "").trim();
  const short = base.replace(/\s*(어드벤처|스키장|해수욕장|카페거리|걷고싶은거리|국내선|제1터미널|제2터미널)$/, "");
  return [...new Set([base, short])];
};

// 갤러리 제목이 우리 이름과 다른 곳 (10/23 제목 조사). 검색어로도 쓰고 제목 비교에도 쓴다
const ALIASES: Record<string, string[]> = {
  haeundae: ["해운대해수욕장", "해운대 일몰"],
  gimhae: ["김해국제공항"],
  yongpyong: ["용평스키장"],
  high1: ["하이원스키장"],
  phoenix: ["휘닉스파크스키장"],
  "welli-hilli": ["웰리힐리파크"],
};
// 짧은 이름으로 걸리지만 다른 곳인 제목
const EXCLUDE: Record<string, string[]> = { lotteworld: ["롯데월드타워"] };
const termsOf = (p: { id: string; name: string }) => [...keywordsOf(p.name), ...(ALIASES[p.id] ?? [])];
const squash = (s: string) => s.replace(/\s/g, "");
// 0 = 전체 이름·별칭이 제목에 있음, 1 = 짧은 이름만 ('하이원 트레킹 코스'보다 '하이원스키장'이 앞에), -1 = 다른 곳
const rankOf = (p: { id: string; name: string }, title: string) => {
  const t = squash(title);
  if ((EXCLUDE[p.id] ?? []).some((k) => t.includes(squash(k)))) return -1;
  if ([keywordsOf(p.name)[0], ...(ALIASES[p.id] ?? [])].some((k) => t.includes(squash(k)))) return 0;
  return termsOf(p).some((k) => t.includes(squash(k))) ? 1 : -1;
};

const prev: Record<string, unknown[]> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const only = (process.env.ONLY ?? "").split(",").filter(Boolean);
const out: Record<string, unknown[]> = { ...prev };
for (const p of PLACES) {
  if (only.length && !only.includes(p.id)) continue;
  const seen = new Set<string>();
  const list: { rank: number; src: string; title: string; photographer: string; month: string }[] = [];
  for (const kw of termsOf(p)) {
    const items = await search(kw);
    if (items === "denied") {
      console.error("관광사진 정보 API 활용신청이 안 되어 있어요 (data.go.kr '한국관광공사_관광사진 정보')");
      process.exit(2);
    }
    for (const it of items) {
      const src = String(it.galWebImageUrl ?? "").replace(/^http:/, "https:");
      if (!src || seen.has(src)) continue;
      // 제목에 장소 이름이 들어 있는 사진만. 검색 키워드는 '멀리 보이는 롯데월드타워'처럼 다른 곳 사진에도 붙어 있어 안 본다 (10/23)
      const rank = rankOf(p, String(it.galTitle ?? ""));
      if (rank < 0) continue;
      seen.add(src);
      list.push({ rank, src, title: String(it.galTitle ?? ""), photographer: String(it.galPhotographer ?? "한국관광공사"), month: String(it.galPhotographyMonth ?? "") });
    }
    if (list.length >= MAX) break;
  }
  // 이름이 온전히 맞는 것, 그다음 최근에 찍은 것부터
  list.sort((a, b) => a.rank - b.rank || b.month.localeCompare(a.month));
  // 지워진 사진(404)은 빼고 크기를 적는다. 대표(첫 장)는 가로 사진으로 (격자 큰 칸이 가로라 세로 사진은 많이 잘린다)
  const ok: { src: string; w: number; h: number; title: string; photographer: string; month: string }[] = [];
  for (const { rank: _, ...it } of list) {
    if (ok.length >= MAX) break;
    const size = await probe(it.src);
    if (size) ok.push({ ...it, ...size, photographer: it.photographer.replace(/^한국관광공사\s*/, "") || "한국관광공사" });
  }
  const wide = ok.findIndex((x) => x.w > x.h);
  if (wide > 0) ok.unshift(...ok.splice(wide, 1));
  if (ok.length) out[p.id] = ok;
  else delete out[p.id];
  console.log(`${p.name}: ${ok.length}장 (후보 ${list.length})`);
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`→ ${OUT}`);
