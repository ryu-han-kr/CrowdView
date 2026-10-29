// SK 장소 혼잡도(퍼즐)가 지원하는 장소와 우리 장소 맞추기 (10/30: 퍼즐은 정해진 장소만 된다 — 남산서울타워 NOT_FOUND_POI)
//   운영의 /api/cron/skt-meta 로 지원 장소 목록(3만 4천 곳, API가 앞 3만 곳까지만 줌)을 받아 이름으로 맞춘다
//   결과: src/data/skt-pois.json ({ [장소 id]: { poiId, poiName } }) — lib/live-count가 있으면 그 poiId로 바로 부르고, 없으면 SK를 부르지 않는다
// 실행: npx tsx scripts/korea-data/skt-pois.mts   (CRON_SECRET) · SKT_ALL=받아 둔 목록.json 이면 다시 받지 않는다
import fs from "node:fs";
import { PLACES } from "../../src/lib/places.ts";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const OUT = "src/data/skt-pois.json";

// 이름이 달라 자동으로 못 맞추거나 잘못 맞는 곳 (10/30 목록 조사). null = 퍼즐에 없음
const MANUAL: Record<string, string | null> = {
  namsan: "N서울타워",
  lotteworld: "롯데월드어드벤쳐",
  high1: "하이원리조트스키장",
  phoenix: "휘닉스평창스노우파크",
  "lotte-waterpark": "김해롯데워터파크본관",
  legoland: "레고랜드코리아리조트",
  alpensia: "알펜시아리조트",
  vivaldi: "비발디파크",
  "icn-t1": null,
  "icn-t2": null,
};

async function fetchAll(): Promise<Record<string, string>> {
  if (process.env.SKT_ALL) return JSON.parse(fs.readFileSync(process.env.SKT_ALL, "utf8"));
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET이 없어요");
  const all: Record<string, string> = {};
  // offset + limit 이 3만을 넘으면 SK가 400을 낸다
  for (let offset = 0; offset < 30_000; offset += 5000) {
    const res = await fetch(`https://crowdview.app/api/cron/skt-meta?offset=${offset}&limit=5000`, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(120_000) });
    const j = (await res.json()) as { contents?: { poiId: string; poiName: string }[] };
    for (const p of j.contents ?? []) all[p.poiId] = p.poiName;
    console.log(`offset ${offset}: ${j.contents?.length ?? 0}`);
  }
  return all;
}

const all = await fetchAll();
const sq = (s: string) => s.replace(/\(.*?\)|\s|·/g, "").toLowerCase();
const byName = new Map<string, string>();
for (const [id, n] of Object.entries(all)) if (!byName.has(sq(n))) byName.set(sq(n), id);

const out: Record<string, { poiId: string; poiName: string }> = {};
for (const p of PLACES) {
  let id: string | undefined;
  if (p.id in MANUAL) id = MANUAL[p.id] ? byName.get(sq(MANUAL[p.id]!)) : undefined;
  else {
    const k = sq(p.name);
    const short = k.replace(/(어드벤처|스키장|해수욕장|국내선|국제선)$/, "");
    id = byName.get(k) ?? byName.get(short);
  }
  if (id) out[p.id] = { poiId: id, poiName: all[id] };
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`→ ${OUT}: ${Object.keys(out).length}/${PLACES.length}곳`);
for (const id of ["namsan", "lotteworld", "everland", "high1", "phoenix", "gyeongbokgung", "haeundae"]) console.log(" ", id, out[id]?.poiName ?? "-");
