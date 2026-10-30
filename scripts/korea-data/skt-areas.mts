// SK 퍼즐 장소의 넓이(㎡) — '지금 실제 인원'을 몇 명으로 보여 주려고 (10/30 경수님: 단계 말고 인원으로).
// SK 실시간 혼잡도(congestion)는 '㎡당 추정 방문자 수'라 넓이를 곱하면 인원이 된다. SK는 넓이를 주지 않아 OpenStreetMap 경계로 잰다
//   결과: src/data/skt-areas.json ({ [장소 id]: { m2, osm, name } }) — 경계를 못 찾은 곳은 빠지고, 그곳은 단계만 보여 준다
// 실행: npx tsx scripts/korea-data/skt-areas.mts   (ONLY=gyeongbokgung,everland)
import fs from "node:fs";
import { PLACES } from "../../src/lib/places.ts";
import sktPois from "../../src/data/skt-pois.json" with { type: "json" };

const OUT = "src/data/skt-areas.json";
const POIS = sktPois as Record<string, { poiId: string; poiName: string }>;
const ONLY = (process.env.ONLY ?? "").split(",").filter(Boolean);
const UA = { "User-Agent": "CrowdView/1.0 (https://crowdview.app)" };

type Geo = { type: "way" | "relation"; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[]; members?: { role: string; geometry?: { lat: number; lon: number }[] }[] };

// 위경도 고리 넓이 (장소 중심 기준 평면 근사, ㎡)
function ringArea(pts: { lat: number; lon: number }[]): number {
  if (pts.length < 3) return 0;
  const lat0 = (pts[0].lat * Math.PI) / 180;
  const R = 6_371_008;
  const xy = pts.map((p) => [((p.lon * Math.PI) / 180) * R * Math.cos(lat0), ((p.lat * Math.PI) / 180) * R]);
  let s = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}
const areaOf = (g: Geo) =>
  g.type === "way" ? ringArea(g.geometry ?? []) : (g.members ?? []).filter((m) => m.role === "outer").reduce((a, m) => a + ringArea(m.geometry ?? []), 0);

const sq = (s: string) => s.replace(/\(.*?\)|\s|·/g, "");

async function find(names: string[], lat: number, lng: number): Promise<{ m2: number; osm: string; name: string } | null> {
  const re = names.map((n) => n.replace(/[.*+?^${}()|[\]\\"]/g, "")).join("|");
  const q = `[out:json][timeout:40];(way(around:1500,${lat},${lng})["name"~"${re}"];relation(around:1500,${lat},${lng})["name"~"${re}"];);out geom;`;
  for (let t = 0; t < 3; t++) {
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { ...UA, "content-type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(q)}`, signal: AbortSignal.timeout(60_000) }).catch(() => null);
    if (!res || res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 5000 * (t + 1)));
      continue;
    }
    const j = (await res.json().catch(() => ({ elements: [] }))) as { elements: Geo[] };
    // 건물 하나·매장 하나가 아니라 장소 전체 경계: 가장 넓은 닫힌 도형
    const best = j.elements
      .filter((e) => !e.tags?.highway && !e.tags?.railway && !e.tags?.route)
      .map((e) => ({ e, m2: areaOf(e) }))
      .filter((x) => x.m2 > 50)
      .sort((a, b) => b.m2 - a.m2)[0];
    return best ? { m2: Math.round(best.m2), osm: `${best.e.type}/${best.e.id}`, name: best.e.tags?.name ?? "" } : null;
  }
  return null;
}

const prev: Record<string, unknown> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const out: Record<string, unknown> = { ...prev };
for (const p of PLACES) {
  const poi = POIS[p.id];
  if (!poi || (ONLY.length && !ONLY.includes(p.id))) continue;
  const names = [...new Set([p.name.replace(/\(.*?\)/g, "").trim(), poi.poiName, sq(p.name)])];
  const hit = await find(names, p.lat, p.lng);
  if (hit) out[p.id] = hit;
  console.log(`${p.name}: ${hit ? `${hit.m2.toLocaleString()}㎡ (${hit.name}, ${hit.osm})` : "-"}`);
  await new Promise((r) => setTimeout(r, 1200));
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`→ ${OUT}: ${Object.keys(out).length}곳`);
