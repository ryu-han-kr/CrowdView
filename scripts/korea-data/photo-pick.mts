// 장소 대표 사진을 Claude로 고르기 (경수님 10/29: 크레딧을 사진 품질에). 후보 = 지금 쓰는 사진 + 관광공사 상세 사진 + 관광사진 갤러리
// 후보를 긴 변 512px로 줄여(토큰 절약) 운영의 /api/cron/photo-pick 에 보내면 Claude가 점수·제외·설명을 매긴다
//   결과: src/data/korea/photo-picks.json ({ [장소 id]: { model, date, photos: [점수 순, 첫 장이 대표] } }) — lib/place-photos가 있으면 이 순서를 쓴다
//   전후 비교: BEFORE_AFTER 폴더(기본 현재 폴더)에 photo-pick-compare.png
// 실행: npx tsx scripts/korea-data/photo-pick.mts   (CRON_SECRET·DATA_GO_KR_KEY, ONLY=everland,high1, MODEL=claude-haiku-5-5|claude-sonnet-5-5|claude-opus-5-5)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PLACES } from "../../src/lib/places.ts";
import { placePhotos, type PlacePhoto } from "../../src/lib/place-photos.ts";
import images from "../../src/data/korea/place-images.json" with { type: "json" };

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const SECRET = process.env.CRON_SECRET;
const KEY = process.env.DATA_GO_KR_KEY;
if (!SECRET) {
  console.error("CRON_SECRET이 없어요");
  process.exit(1);
}
const ENDPOINT = process.env.ENDPOINT ?? "https://crowdview.app/api/cron/photo-pick";
const MODEL = process.env.MODEL ?? "claude-haiku-5-5";
const OUT = process.env.OUT ?? "src/data/korea/photo-picks.json";
const COMPARE_DIR = process.env.BEFORE_AFTER ?? ".";
// 시험 10곳 (테마파크 6 · 스키장 4). 대표를 직접 고른 곳(HERO)·기존 대표를 지킨 곳(KEEP_HERO)은 뺐다
const PILOT = ["lotteworld", "everland", "seoulland", "legoland", "lotteworld-busan", "oworld", "yongpyong", "high1", "vivaldi", "muju"];
const ONLY = (process.env.ONLY ?? "").split(",").filter(Boolean);
const ids = ONLY.length ? ONLY : PILOT;
const MAX = 20;
const KTO = { credit: "한국관광공사", license: "공공누리 제1유형" };

// 관광사진 갤러리 (전문 사진가). 제목에 장소 이름이 있는 것만
async function gallery(name: string): Promise<PlacePhoto[]> {
  if (!KEY) return [];
  const kw = name.replace(/\(.*?\)/g, "").trim();
  const short = kw.replace(/\s*(어드벤처|스키장|스노우파크|리조트)$/, "").replace(/^모나/, "");
  const out: PlacePhoto[] = [];
  for (const k of [...new Set([kw, short])]) {
    const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", numOfRows: "40", pageNo: "1", arrange: "A", keyword: k });
    const res = await fetch(`https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1?${qs}`, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = res ? ((await res.json().catch(() => ({}))) as any).response?.body?.items?.item : undefined;
    for (const it of Array.isArray(items) ? items : items ? [items] : []) {
      const title = String(it.galTitle ?? "");
      if (!title.replace(/\s/g, "").includes(short.replace(/\s/g, ""))) continue;
      const by = String(it.galPhotographer ?? "").replace(/^한국관광공사\s*/, "");
      out.push({ src: String(it.galWebImageUrl ?? "").replace(/^http:/, "https:"), credit: by ? `한국관광공사 · ${by}` : "한국관광공사", license: KTO.license, alt: title });
    }
  }
  return out;
}

// 받아서 크기를 재고 512px로 줄인다. 작은 사진(긴 변 900px 미만)·깨진 사진은 null
async function load(p: PlacePhoto): Promise<{ p: PlacePhoto; small: Buffer } | null> {
  try {
    const res = await fetch(p.src, { signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "CrowdView/1.0 (https://crowdview.app)" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height || Math.max(meta.width, meta.height) < 900) return null;
    const small = await sharp(buf).rotate().resize(512, 512, { fit: "inside" }).jpeg({ quality: 72 }).toBuffer();
    return { p: { ...p, w: p.w ?? meta.width, h: p.h ?? meta.height }, small };
  } catch {
    return null;
  }
}

type Pick = { n: number; score: number; reject: boolean; reason: string; alt: string };
const prev: Record<string, unknown> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const out: Record<string, unknown> = { ...prev };
const rows: { name: string; before?: Buffer; after: Buffer[] }[] = [];
let tokens = 0;
for (const id of ids) {
  const place = PLACES.find((p) => p.id === id);
  if (!place) continue;
  const current = placePhotos(id);
  const kto = ((images as Record<string, string[]>)[id] ?? []).map((src) => ({ src, ...KTO }));
  const all = [...current, ...kto, ...(await gallery(place.name))].filter((p, i, a) => p.src && a.findIndex((x) => x.src === p.src) === i);
  const loaded = (await Promise.all(all.slice(0, MAX + 10).map(load))).filter((x): x is NonNullable<typeof x> => !!x).slice(0, MAX);
  if (loaded.length < 3) {
    console.log(`${place.name}: 후보 ${loaded.length}장 — 건너뜀`);
    continue;
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ name: place.name, category: place.category === "ski" ? "스키장" : "테마파크", model: MODEL, images: loaded.map((x) => x.small.toString("base64")) }),
    signal: AbortSignal.timeout(290_000),
  });
  const j = (await res.json().catch(() => ({}))) as { photos?: Pick[]; hero?: number; error?: string; usage?: { input_tokens: number; output_tokens: number } };
  if (!j.photos) {
    console.log(`${place.name}: 실패 ${res.status} ${j.error ?? ""}`);
    continue;
  }
  tokens += (j.usage?.input_tokens ?? 0) + (j.usage?.output_tokens ?? 0);
  const by = new Map(j.photos.map((x) => [x.n, x]));
  const kept = loaded
    .map((x, i) => ({ ...x, pick: by.get(i + 1)! }))
    .filter((x) => x.pick && !x.pick.reject)
    .sort((a, b) => Number(b.pick.n === j.hero) - Number(a.pick.n === j.hero) || b.pick.score - a.pick.score);
  out[id] = { model: MODEL, date: new Date().toISOString().slice(0, 10), photos: kept.map((x) => ({ ...x.p, alt: x.pick.alt || x.p.alt, score: x.pick.score })) };
  console.log(`${place.name}: 후보 ${loaded.length} → 사용 ${kept.length} (제외 ${loaded.length - kept.length}), 대표 ${kept[0]?.pick.score}점 · ${kept[0]?.pick.reason}`);
  const beforeSrc = current[0]?.src;
  rows.push({ name: place.name, before: loaded.find((x) => x.p.src === beforeSrc)?.small, after: kept.slice(0, 4).map((x) => x.small) });
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`→ ${OUT} · 토큰 ${tokens.toLocaleString()} (${MODEL})`);

// 전후 비교 한 장: 줄마다 [지금 대표] | [새 대표] [2] [3] [4]
const W = 300;
const H = 200;
const PAD = 8;
const LABEL = 28;
const tiles: sharp.OverlayOptions[] = [];
const cell = async (buf: Buffer | undefined) =>
  buf ? sharp(buf).resize(W, H, { fit: "cover" }).toBuffer() : sharp({ create: { width: W, height: H, channels: 3, background: "#ddd" } }).jpeg().toBuffer();
const label = (s: string, w: number) =>
  Buffer.from(`<svg width="${w}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="20" font-family="Malgun Gothic, sans-serif" font-size="16" font-weight="700">${s}</text></svg>`);
for (const [r, row] of rows.entries()) {
  const y = r * (H + LABEL + PAD);
  tiles.push({ input: label(`${row.name} — 왼쪽: 지금 대표 | 오른쪽: 새 대표 · 다음 3장`, 5 * (W + PAD) + 16), left: 0, top: y });
  tiles.push({ input: await cell(row.before), left: 0, top: y + LABEL });
  for (const [i, b] of row.after.entries()) tiles.push({ input: await cell(b), left: (i + 1) * (W + PAD) + 16, top: y + LABEL });
}
if (rows.length) {
  const file = path.join(COMPARE_DIR, "photo-pick-compare.png");
  await sharp({ create: { width: 5 * (W + PAD) + 16, height: rows.length * (H + LABEL + PAD), channels: 3, background: "#fff" } })
    .composite(tiles)
    .png()
    .toFile(file);
  console.log(`→ ${file}`);
}
