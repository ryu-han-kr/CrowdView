// 장소 사진 고르기 (경수님 10/29~30). 순서: ① 사전조사 ② 명소별 사진 모으기 ③ 기준 채점 ④ 애매한 건 경수님 확인
//   ① /api/cron/photo-spots: Claude가 웹 검색으로 그곳의 대표 명소·포토 스폿과 검색어를 정리 → src/data/korea/photo-spots.json (한 번 하면 다시 안 함)
//   ② 명소마다 위키미디어 공용(CC0·CC BY·CC BY-SA, 긴 변 1,200px 이상)에서 후보 + 지금 쓰는 사진
//   ③ 후보를 긴 변 512px로 줄여(토큰 절약) /api/cron/photo-pick 에 보내면 Claude가 점수·제외·명소·설명을 매긴다
//      7점 이상 = 바로 사용 (대표 → 명소마다 1장 → 나머지 점수 순), 5~6점 = 애매 → pending 으로 두고 확인 시트를 만든다
//   결과: src/data/korea/photo-picks.json ({ [장소 id]: { model, date, photos, pending } }) — lib/place-photos가 photos 순서를 쓴다
//   비교·확인 시트: BEFORE_AFTER 폴더(기본 현재 폴더)에 photo-pick-compare.png, photo-pick-pending.png
// 실행: npx tsx scripts/korea-data/photo-pick.mts   (CRON_SECRET, ONLY=everland,high1, MODEL=claude-sonnet-5-5|claude-haiku-5-5|claude-opus-5-5, RESEARCH=1 다시 조사)
//       APPROVE=everland:3,7 → 확인 시트 번호를 photos 로 옮긴다 (Claude는 다시 부르지 않음)
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PLACES } from "../../src/lib/places.ts";
import { placePhotos, type PlacePhoto } from "../../src/lib/place-photos.ts";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const SECRET = process.env.CRON_SECRET;
if (!SECRET) {
  console.error("CRON_SECRET이 없어요");
  process.exit(1);
}
const BASE = process.env.ENDPOINT ?? "https://crowdview.app/api/cron";
const MODEL = process.env.MODEL ?? "claude-sonnet-5-5";
const OUT = "src/data/korea/photo-picks.json";
const SPOTS_OUT = "src/data/korea/photo-spots.json";
const SHEET_DIR = process.env.BEFORE_AFTER ?? ".";
// 시험 9곳 (테마파크 5 · 스키장 4). 대표를 직접 고른 곳(HERO)·기존 대표를 지킨 곳(KEEP_HERO)은 뺐다
const PILOT = ["everland", "lotteworld", "seoulland", "legoland", "oworld", "yongpyong", "high1", "vivaldi", "muju"];
// 장소 종류 → 채점 프롬프트에 쓰는 이름
const KIND: Record<string, string> = { ski: "스키장", themepark: "테마파크", waterpark: "워터파크", landmark: "관광지", street: "거리", beach: "해수욕장", indoor: "실내 놀거리", event: "축제" };
const ONLY = (process.env.ONLY ?? "").split(",").filter(Boolean);
const MAX = 36;
const PER_SPOT = 5;
const UA = { "User-Agent": "CrowdView/1.0 (https://crowdview.app; photo curation)" };

type Pick = { n: number; score: number; reject: boolean; spot: string; reason: string; alt: string };
type Saved = PlacePhoto & { score: number; label?: string; reason?: string; gname?: string };
// 구글 지도 사진 후보 (GOOGLE=1): 받아 보는 주소(src)와 저장할 사진 이름(gname)
type Cand = PlacePhoto & { gname?: string };
type Entry = { model: string; date: string; photos: Saved[]; pending: Saved[] };
type Spots = { nameEn?: string; spots: { label: string; why: string; queries: string[] }[] };

const picks: Record<string, Entry> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const spotsAll: Record<string, Spots> = fs.existsSync(SPOTS_OUT) ? JSON.parse(fs.readFileSync(SPOTS_OUT, "utf8")) : {};
const save = () => {
  fs.writeFileSync(OUT, JSON.stringify(picks, null, 1) + "\n");
  fs.writeFileSync(SPOTS_OUT, JSON.stringify(spotsAll, null, 1) + "\n");
};

// 확인 시트에서 고른 번호를 사용 사진으로 옮긴다
if (process.env.APPROVE) {
  for (const part of process.env.APPROVE.split(";")) {
    const [id, nums] = part.split(":");
    const e = picks[id];
    if (!e) continue;
    const take = new Set(nums.split(",").map((x) => Number(x) - 1));
    e.photos.push(...e.pending.filter((_, i) => take.has(i)));
    e.pending = e.pending.filter((_, i) => !take.has(i));
    console.log(`${id}: ${take.size}장 사용으로 옮김`);
  }
  save();
  process.exit(0);
}

async function post<T>(route: string, body: unknown): Promise<T & { error?: string; usage?: { input_tokens: number; output_tokens: number } }> {
  const res = await fetch(`${BASE}/${route}`, {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(295_000),
  });
  return (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as T & { error?: string };
}

// 위키미디어 공용: 상업적 이용·변경이 되는 라이선스만 (NC·ND 제외), 긴 변 1,200px 이상
async function commons(q: string): Promise<PlacePhoto[]> {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=15&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = (await (await fetch(u, { headers: UA, signal: AbortSignal.timeout(20_000) })).json().catch(() => ({}))) as {
    query?: { pages?: Record<string, { title: string; imageinfo?: { thumburl?: string; width: number; height: number; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] }> };
  };
  return Object.values(j.query?.pages ?? {})
    .map((p) => {
      const ii = p.imageinfo?.[0];
      const m = ii?.extmetadata ?? {};
      // 첫 줄만 (10/31: 작가 칸에 'Asacyan' 뒤로 촬영 장비 설명이 여러 줄 붙어 있었다)
      const who = String(m.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim().split("\n")[0].trim().slice(0, 60) || "Unknown";
      return { src: String(ii?.thumburl ?? "").split("?")[0], w: ii?.width ?? 0, h: ii?.height ?? 0, page: ii?.descriptionurl, lic: m.LicenseShortName?.value ?? "", who };
    })
    .filter((x) => x.src && Math.max(x.w, x.h) >= 1200 && /CC0|CC BY|Public domain/i.test(x.lic) && !/NC|ND/.test(x.lic))
    .map((x) => ({ src: x.src, w: x.w, h: x.h, credit: `${x.who} / Wikimedia Commons`, license: x.lic, page: x.page }));
}

// 구글 지도 방문자 사진 (GOOGLE=1, 경수님 10/30: 관광공사·위키미디어에 밝은 사진이 없는 곳). 키가 운영에만 있어 /api/cron/photo-google 로 받는다
async function google(id: string): Promise<Cand[]> {
  const r = await post<{ photos?: { name: string; uri: string; w: number; h: number; author: string; authorUri?: string }[] }>("photo-google", { id, max: 10 });
  if (!r.photos) console.log(`  구글 사진 실패 ${r.error ?? ""}`);
  return (r.photos ?? []).map((x) => ({ src: x.uri, w: x.w, h: x.h, credit: `Google 지도 · ${x.author && x.author !== "null" ? x.author : "방문자"}`, license: "Google 지도 사용자 사진", page: x.authorUri, gname: x.name }));
}
/** 구글 사진을 보낼 우리 주소 (api/gphoto/[id]/[k]) — 사진 이름의 짧은 해시 */
const gsrc = (id: string, gname: string) => `/api/gphoto/${id}/${createHash("sha1").update(gname).digest("hex").slice(0, 12)}`;

// 관광공사 관광사진 갤러리 (전문 사진가 촬영, 공공누리 제1유형) — 장소 이름으로 찾아 제목·검색어에 그 이름이 있는 것만 (10/30: 키워드 검색이 다시 된다)
async function kto(name: string): Promise<PlacePhoto[]> {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) return [];
  const qs = new URLSearchParams({ serviceKey: key, MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", numOfRows: "30", pageNo: "1", arrange: "A", keyword: name });
  const j = (await (await fetch(`https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1?${qs}`, { signal: AbortSignal.timeout(20_000) })).json().catch(() => ({}))) as {
    response?: { body?: { items?: { item?: Record<string, string> | Record<string, string>[] } } };
  };
  const squash = (x: string) => x.replace(/\s/g, "");
  return [j.response?.body?.items?.item ?? []]
    .flat()
    .filter((x) => x.galWebImageUrl && squash(`${x.galTitle} ${x.galSearchKeyword}`).includes(squash(name)))
    .map((x) => ({ src: x.galWebImageUrl, credit: ["한국관광공사", x.galPhotographer?.replace(/^한국관광공사\s*/, "")].filter(Boolean).join(" · "), license: "공공누리 제1유형", alt: x.galTitle }));
}

async function load(p: PlacePhoto): Promise<{ p: PlacePhoto; small: Buffer } | null> {
  try {
    const res = await fetch(p.src, { signal: AbortSignal.timeout(30_000), headers: UA });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height || Math.max(meta.width, meta.height) < 900) return null;
    const small = await sharp(buf).rotate().resize(512, 512, { fit: "inside" }).jpeg({ quality: 72 }).toBuffer();
    return { p: { ...p, w: p.w || meta.width, h: p.h || meta.height }, small };
  } catch {
    return null;
  }
}

const cell = async (buf: Buffer | undefined, w: number, h: number) =>
  buf ? sharp(buf).resize(w, h, { fit: "cover" }).toBuffer() : sharp({ create: { width: w, height: h, channels: 3, background: "#ddd" } }).jpeg().toBuffer();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const label = (s: string, w: number, h = 28, size = 16) =>
  Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="${h - 8}" font-family="Malgun Gothic, sans-serif" font-size="${size}" font-weight="700">${esc(s)}</text></svg>`);

const compare: { name: string; before: (Buffer | undefined)[]; after: { buf: Buffer; tag: string }[] }[] = [];
const pendingRows: { name: string; items: { buf: Buffer; tag: string }[] }[] = [];
let tokens = 0;
const lacking: string[] = [];

for (const id of ONLY.length ? ONLY : PILOT) {
  const place = PLACES.find((p) => p.id === id);
  if (!place) continue;
  // ① 사전조사
  if (!spotsAll[id] || process.env.RESEARCH) {
    const r = await post<Spots>("photo-spots", { name: place.name, address: place.address });
    if (!r.spots?.length) {
      console.log(`${place.name}: 사전조사 실패 ${r.error ?? ""}`);
      continue;
    }
    tokens += (r.usage?.input_tokens ?? 0) + (r.usage?.output_tokens ?? 0);
    spotsAll[id] = { nameEn: r.nameEn, spots: r.spots };
    save();
  }
  const spots = spotsAll[id].spots;
  console.log(`${place.name} 명소: ${spots.map((s) => s.label).join(" · ")}`);

  // ② 명소별 후보 + 지금 사진
  const current = placePhotos(id);
  const found: PlacePhoto[] = [];
  for (const s of spots) {
    const per: PlacePhoto[] = [];
    for (const q of s.queries) {
      if (per.length >= PER_SPOT) break;
      for (const p of await commons(q)) if (!per.some((x) => x.src === p.src) && per.length < PER_SPOT) per.push(p);
    }
    found.push(...per);
  }
  const pro = (await kto(place.name.replace(/\(.*?\)/g, "").trim()).catch(() => [])).slice(0, 12);
  const goo = process.env.GOOGLE ? await google(id).catch(() => []) : [];
  // 구글 사진을 못 받으면(무료분 보호선 등) 건너뛴다 — 10/31: 오락실이 위키미디어의 엉뚱한 사진(미군 기지 오락실·광안리 해변)으로 채워졌다
  if (process.env.GOOGLE && !goo.length) {
    console.log(`  ${place.name}: 구글 사진 없음 — 건너뜀`);
    lacking.push(id);
    continue;
  }
  const all: Cand[] = [...current.slice(0, 8), ...pro, ...goo, ...found].filter((p, i, a) => a.findIndex((x) => x.src === p.src) === i);
  const loaded = (await Promise.all(all.slice(0, MAX + 8).map(load))).filter((x): x is NonNullable<typeof x> => !!x).slice(0, MAX);
  if (loaded.length < 3) {
    console.log(`${place.name}: 후보 ${loaded.length}장 — 건너뜀`);
    continue;
  }

  // ③ 채점
  const j = await post<{ photos?: Pick[]; hero?: number }>("photo-pick", {
    name: place.name,
    category: KIND[place.category] ?? "관광지",
    model: MODEL,
    spots: spots.map((s) => s.label),
    images: loaded.map((x) => x.small.toString("base64")),
  });
  if (!j.photos) {
    console.log(`${place.name}: 채점 실패 ${j.error ?? ""}`);
    continue;
  }
  tokens += (j.usage?.input_tokens ?? 0) + (j.usage?.output_tokens ?? 0);
  const by = new Map(j.photos.map((x) => [x.n, x]));
  const scored = loaded
    .map((x, i) => ({ ...x, pick: by.get(i + 1), n: i + 1 }))
    .filter((x): x is typeof x & { pick: Pick } => !!x.pick && !x.pick.reject)
    .sort((a, b) => b.pick.score - a.pick.score);
  const good = scored.filter((x) => x.pick.score >= 7);
  // 대표 → 명소마다 가장 좋은 1장 → 나머지
  const hero = good.find((x) => x.n === j.hero) ?? good[0];
  const firsts = spots.map((s) => good.find((x) => x !== hero && x.pick.spot === s.label)).filter((x): x is NonNullable<typeof x> => !!x);
  const ordered = [hero, ...firsts, ...good.filter((x) => x !== hero && !firsts.includes(x))].filter((x): x is NonNullable<typeof x> => !!x);
  const unsure = scored.filter((x) => x.pick.score >= 5 && x.pick.score < 7);
  const toSaved = (x: (typeof scored)[number]): Saved => ({
    ...x.p,
    ...((x.p as Cand).gname ? { src: gsrc(id, (x.p as Cand).gname!) } : {}),
    alt: x.pick.alt || x.p.alt,
    score: x.pick.score,
    label: x.pick.spot && x.pick.spot !== "전경" ? x.pick.spot : undefined,
    reason: x.pick.reason,
  });
  // 좋은 사진이 4장도 안 되면 덮어쓰지 않는다 (10/30: 김해·인천 T2가 2장만 남아 갤러리가 비었다) → GOOGLE=1로 다시.
  // 고른 사진이 아직 하나도 없는 곳은 2장만 돼도 넣는다 (10/31: 실내 체험장 7곳이 구글까지 1~3장뿐 — 빈 것보다 낫다)
  if (ordered.length < (picks[id]?.photos.length ? 4 : 2)) {
    console.log(`  ${place.name}: 좋은 사진 ${ordered.length}장뿐 — 그대로 두고 구글 지도 사진으로 다시 (GOOGLE=1)`);
    lacking.push(id);
    continue;
  }
  picks[id] = { model: MODEL, date: new Date().toISOString().slice(0, 10), photos: ordered.map(toSaved), pending: unsure.map(toSaved) };
  save();
  console.log(`  후보 ${loaded.length} → 사용 ${ordered.length} · 애매 ${unsure.length} · 제외 ${loaded.length - scored.length + scored.filter((x) => x.pick.score < 5).length}`);
  console.log(`  대표 ${hero?.pick.score}점 [${hero?.pick.spot}] ${hero?.pick.reason}`);
  const small = new Map(loaded.map((x) => [x.p.src, x.small]));
  compare.push({
    name: place.name,
    before: current.slice(0, 5).map((p) => small.get(p.src)),
    after: ordered.slice(0, 5).map((x) => ({ buf: x.small, tag: `${x.pick.score}점 ${x.pick.spot}` })),
  });
  if (unsure.length) pendingRows.push({ name: place.name, items: unsure.map((x, i) => ({ buf: x.small, tag: `${i + 1}번 · ${x.pick.score}점 ${x.pick.spot}` })) });
}
console.log(`→ ${OUT} · 토큰 ${tokens.toLocaleString()} (${MODEL})`);
if (lacking.length) console.log(`좋은 사진이 모자란 곳 (GOOGLE=1로 다시): ONLY=${lacking.join(",")}`);

// 전후 비교: 장소마다 [지금 5장] 아래 [새 5장 + 점수·명소]
const W = 280;
const H = 186;
const G = 6;
const tiles: sharp.OverlayOptions[] = [];
let y = 0;
for (const row of compare) {
  tiles.push({ input: label(`${row.name} — 위: 지금 / 아래: 새로 고른 순서`, 5 * (W + G), 30, 18), left: 0, top: y });
  y += 30;
  for (const [i, b] of row.before.entries()) tiles.push({ input: await cell(b, W, H), left: i * (W + G), top: y });
  y += H + G;
  for (const [i, a] of row.after.entries()) {
    tiles.push({ input: await cell(a.buf, W, H), left: i * (W + G), top: y });
    tiles.push({ input: label(a.tag, W, 24, 14), left: i * (W + G), top: y + H });
  }
  y += H + 24 + 18;
}
if (compare.length) {
  const file = path.join(SHEET_DIR, "photo-pick-compare.png");
  await sharp({ create: { width: 5 * (W + G), height: y, channels: 3, background: "#fff" } }).composite(tiles).png().toFile(file);
  console.log(`→ ${file}`);
}

// 애매한 사진 확인 시트: 번호를 보고 APPROVE=장소id:번호,번호
const pt: sharp.OverlayOptions[] = [];
y = 0;
for (const row of pendingRows) {
  pt.push({ input: label(row.name, 5 * (W + G), 30, 18), left: 0, top: y });
  y += 30;
  for (const [i, it] of row.items.entries()) {
    const x = (i % 5) * (W + G);
    if (i && i % 5 === 0) y += H + 24 + G;
    pt.push({ input: await cell(it.buf, W, H), left: x, top: y });
    pt.push({ input: label(it.tag, W, 24, 14), left: x, top: y + H });
  }
  y += H + 24 + 18;
}
if (pendingRows.length) {
  const file = path.join(SHEET_DIR, "photo-pick-pending.png");
  await sharp({ create: { width: 5 * (W + G), height: y, channels: 3, background: "#fff" } }).composite(pt).png().toFile(file);
  console.log(`→ ${file}`);
}
