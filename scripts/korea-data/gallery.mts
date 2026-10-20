// 상세 화면 위 사진 넘겨 보기용 사진 모으기 (장소·대표 명소마다 최소 5장 목표, 최대 12장)
//   우리 장소(lib/places.ts)  → src/data/korea/place-images.json ({ [장소 id]: [url, …] })
//   대표 명소(landmarks.json) → src/data/korea/spot-images.json  ({ [명소 id]: [url, …] })
// 순서: ① 그 콘텐츠의 관광공사 사진(detailImage2) ② 모자라면 이름으로 검색(searchKeyword2)한 같은 곳의 대표 사진·사진 묶음
// 실행: npx tsx scripts/korea-data/gallery.mts  (DATA_GO_KR_KEY, 호출 약 250건 · 개발 계정 하루 1,000건 안)
//       ONLY=hongdae,gimhae 처럼 주면 그 곳만 다시 모으고 나머지는 지난 결과 그대로
import fs from "node:fs";
import path from "node:path";
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

const MIN = 5;
const MAX = 12;
type Item = Record<string, string>;

async function call(op: string, params: Record<string, string>): Promise<Item[]> {
  const qs = new URLSearchParams({ serviceKey: KEY!, MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", numOfRows: "30", pageNo: "1", ...params });
  try {
    const res = await fetch(`https://apis.data.go.kr/B551011/KorService2/${op}?${qs}`, { signal: AbortSignal.timeout(15_000) });
    const items = (await res.json()).response?.body?.items?.item;
    return Array.isArray(items) ? items : items ? [items] : [];
  } catch {
    return [];
  }
}

const https = (u?: string) => String(u ?? "").replace(/^http:/, "https:");
const ok = (u: string) => u.startsWith("https://tong.visitkorea.or.kr/");
const detailImages = async (cid: string) =>
  (await call("detailImage2", { contentId: cid, imageYN: "Y" })).map((i) => https(i.originimgurl)).filter(ok);
// 띄어쓰기·괄호를 빼고 비교 (예: "롯데월드 어드벤처" ↔ "롯데월드어드벤처(잠실)")
const norm = (s: string) => s.replace(/\(.*?\)|\s|·/g, "");

async function collect(name: string, cid: string | undefined, keywords: string[], first?: string): Promise<string[]> {
  const out = new Set<string>(first && ok(first) ? [first] : []);
  if (cid) for (const u of await detailImages(cid)) out.add(u);
  for (const keyword of keywords) {
    if (out.size >= MIN) break;
    const core = norm(keyword);
    const hits = (await call("searchKeyword2", { keyword })).filter((r) => norm(r.title ?? "").includes(core) || core.includes(norm(r.title ?? "")));
    for (const h of hits) {
      if (out.size >= MAX) break;
      for (const u of [https(h.firstimage), https(h.firstimage2)]) if (ok(u)) out.add(u);
      if (out.size < MIN && h.contentid !== cid) for (const u of await detailImages(h.contentid)) out.add(u);
    }
  }
  const list = [...out].slice(0, MAX);
  console.log(`${name}: ${list.length}장${list.length < MIN ? "  ← 모자람" : ""}`);
  return list;
}

// 키워드 검색에 쓸 이름 (관광공사 등록 이름이 다른 곳). 앞에서부터 찾아 5장이 될 때까지
const KEYWORD: Record<string, string[]> = {
  // '홍대'만으로 찾으면 '나이키 홍대점' 같은 가게 사진이 섞여 정확한 이름만
  hongdae: ["홍대걷고싶은거리", "홍대 걷고싶은거리"],
  "seoul-fireworks": ["여의도한강공원", "서울세계불꽃축제"],
  "caribbean-bay": ["캐리비안베이", "캐리비안 베이"],
  "splas-resom": ["스플라스", "리솜"],
  high1: ["하이원", "하이원리조트", "강원랜드"],
  phoenix: ["휘닉스", "휘닉스파크", "휘닉스 평창"],
  konjiam: ["곤지암", "곤지암리조트"],
  oakvalley: ["오크밸리"],
  alpensia: ["알펜시아", "알펜시아리조트"],
  "haedong-yonggungsa": ["해동용궁사", "용궁사"],
  "icn-t1": ["인천국제공항"],
  "icn-t2": ["인천국제공항"],
  gimpo: ["김포국제공항", "김포공항"],
  "jeju-airport": ["제주국제공항", "제주공항"],
  gimhae: ["김해국제공항", "김해공항"],
};

// 관광공사 사진이 없는 곳: 위키미디어 공용에서 받아 public/places에 둔 사진 (사진마다 출처는 src/data/korea/photo-credits.json)
const LOCAL: Record<string, string[]> = {
  "caribbean-bay": [2, 3, 4, 5].map((i) => `/places/caribbean-bay-${i}.jpg`),
  gimhae: [2, 3, 4, 5].map((i) => `/places/gimhae-${i}.jpg`),
};

const ONLY = process.env.ONLY?.split(",");
const prevPlaces = JSON.parse(fs.readFileSync(path.join("src", "data", "korea", "place-images.json"), "utf8")) as Record<string, string[]>;
const prevSpots = JSON.parse(fs.readFileSync(path.join("src", "data", "korea", "spot-images.json"), "utf8")) as Record<string, string[]>;

const places: Record<string, string[]> = {};
for (const p of PLACES) {
  if (ONLY && !ONLY.includes(p.id) && prevPlaces[p.id]) {
    places[p.id] = prevPlaces[p.id];
    continue;
  }
  if (LOCAL[p.id]) {
    places[p.id] = LOCAL[p.id];
    continue;
  }
  // 첫 장은 화면이 따로 넣는 대표 사진(place.image, 우리 사이트 파일)이라 여기선 관광공사 사진만
  places[p.id] = await collect(p.name, p.ktoContent ? String(p.ktoContent.id) : undefined, KEYWORD[p.id] ?? [p.name]);
}
fs.writeFileSync(path.join("src", "data", "korea", "place-images.json"), JSON.stringify(places));

const landmarks = JSON.parse(fs.readFileSync(path.join("src", "data", "korea", "landmarks.json"), "utf8")) as {
  id: string;
  cid: string;
  img: string;
  n: { ko: string };
}[];
const spots: Record<string, string[]> = {};
for (const l of landmarks)
  spots[l.id] = ONLY && !ONLY.includes(l.id) ? (prevSpots[l.id] ?? []) : await collect(l.n.ko, l.cid, KEYWORD[l.id] ?? [l.n.ko], https(l.img));
fs.writeFileSync(path.join("src", "data", "korea", "spot-images.json"), JSON.stringify(spots));

const short = [...Object.entries(places), ...Object.entries(spots)].filter(([, v]) => v.length < MIN).map(([k, v]) => `${k}(${v.length})`);
console.log(`완료: 장소 ${Object.keys(places).length}곳 · 명소 ${Object.keys(spots).length}곳 · ${MIN}장 미만 ${short.length}곳 ${short.join(", ")}`);
