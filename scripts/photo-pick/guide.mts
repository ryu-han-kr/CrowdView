import fs from "node:fs";
import { GUIDE } from "../../src/lib/seoul-guide.ts";
for (const line of fs.readFileSync(process.cwd() + "/.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { LANDMARKS } from "../../src/lib/korea.ts";
import { SEOUL_AREAS } from "../../src/lib/seoul-areas.ts";
const norm = (s: string) => s.replace(/[\s()·]/g, "");
const FAMOUS = LANDMARKS.filter((l: any) => l.region === "서울").map((l: any) => norm(l.n.ko));
const LMIMG = new Set(LANDMARKS.map((l: any) => l.img));
const AREAS = SEOUL_AREAS.map((a: any) => norm(a.name.replace(/관광특구|역$/g, ""))).filter((n: string) => n.length >= 3);
const fame = (p: any) => { const n = norm(p.t.ko?.n ?? ""); const exact = FAMOUS.findIndex((f: string) => f === n || (n.length >= 3 && f.startsWith(n) && f.length - n.length <= 6) || (n.startsWith(f) && /^[A-Za-z]+$/.test(n.slice(f.length)))); if (n.length >= 2 && exact >= 0) return exact / 100; if (n.length >= 3 && FAMOUS.some((f: string) => n.startsWith(f) || f.includes(n))) return p.img ? 1 : 3.5; if (n.length >= 3 && AREAS.some((a: string) => n.startsWith(a))) return p.img ? 2 : 3.5; return p.img ? 3 : 4; };
const KEY = process.env.DATA_GO_KR_KEY!;
const sq = (s: string) => s.replace(/[\s()·]/g, "");
async function search(kw: string) {
  const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", numOfRows: "30", pageNo: "1", arrange: "A", keyword: kw });
  const r = await fetch(`https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1?${qs}`, { signal: AbortSignal.timeout(20000) });
  const txt = await r.text();
  if (/LIMITED|초과/.test(txt)) throw new Error("quota");
  try { const it = JSON.parse(txt).response?.body?.items?.item; return Array.isArray(it) ? it : it ? [it] : []; } catch { return []; }
}
const N = Number(process.argv[3] ?? 140);
const list = (GUIDE as any[]).filter((g) => g.kind === "attraction").sort((x, y) => fame(x) - fame(y)).filter((g) => !LMIMG.has(g.img)).slice(0, N);
const out: Record<string, any> = {};
for (const g of list) {
  const name = (g.t.ko?.n ?? "").replace(/\(.*?\)/g, "").trim();
  if (name.length < 2) continue;
  const c: any[] = [];
  for (const it of await search(name)) {
    const src = String(it.galWebImageUrl ?? "").replace(/^http:/, "https:");
    const t = sq(String(it.galTitle));
    if (!src || !(t === sq(name) || t.startsWith(sq(name)))) continue;
    c.push({ src, title: String(it.galTitle), who: String(it.galPhotographer ?? ""), month: String(it.galPhotographyMonth ?? "") });
  }
  c.sort((x, y) => y.month.localeCompare(x.month));
  if (c.length) out[g.id] = { kind: g.kind, name, cur: g.img, c: c.slice(0, 11) };
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
console.log("matched", Object.keys(out).length, "of", list.length);
