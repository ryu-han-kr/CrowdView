// 구글 장소 정보(lib/google-facts) 처음 채우기: 로컬에서 미리 받아 둔 Place Details 응답 묶음을 운영 Redis(gfacts 해시)에 넣는다.
// 운영 서버의 이달 상세 호출 몫을 쓰지 않으려고 (10/31 지난달 무료분으로 받아 둠). 이후 갱신은 수집기(api/cron/refresh)가 10일마다.
// 입력 JSON: { 우리 장소 id: { gid, km, at, details: <Places API v1 place> } | { nomatch: true } | { err } }
// 실행: ENV_FILE=../.env.local node --import tsx scripts/korea-data/google-facts-seed.mts google.json   (DRY=1이면 쓰지 않고 요약만)
import fs from "node:fs";
import { PLACES } from "../../src/lib/places.ts";
import { factsFromDetails, wantsFacts, type GDetails, type GoogleFacts } from "../../src/lib/google-facts.ts";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const DRY = process.env.DRY === "1";
const file = process.argv[2];
if (!file) throw new Error("입력 JSON 경로를 주세요");
if (!DRY && (!URL_ || !TOKEN)) throw new Error("KV_REST_API_URL/TOKEN 없음 (ENV_FILE)");

const redis = async (commands: (string | number)[][]) => {
  const res = await fetch(`${URL_}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(commands) });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return (await res.json()) as { result?: unknown; error?: string }[];
};

type Row = { gid?: string; km?: number; at?: string; details?: GDetails; nomatch?: true; err?: unknown };
const input = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, Row>;

// 이미 있는 값(리뷰 수 기록)은 이어서 쓴다
const prev: Record<string, GoogleFacts> = {};
if (!DRY) {
  const [{ result }] = await redis([["HGETALL", "gfacts"]]);
  const flat = (result as string[] | null) ?? [];
  for (let i = 0; i + 1 < flat.length; i += 2) prev[flat[i]] = JSON.parse(flat[i + 1]) as GoogleFacts;
}

const out: [string, GoogleFacts][] = [];
const skipped: string[] = [];
for (const p of PLACES.filter(wantsFacts)) {
  const row = input[p.id];
  if (!row || row.err) {
    skipped.push(p.id);
    continue;
  }
  const at = row.at ?? new Date().toISOString();
  const date = new Date(Date.parse(at) + 9 * 3600_000).toISOString().slice(0, 10);
  out.push([p.id, row.details ? factsFromDetails(p, { id: row.gid, ...row.details }, prev[p.id], at, date) : { at, miss: "검색 결과 없음" }]);
}

const hit = out.filter(([, f]) => !f.miss);
console.log(`대상 ${PLACES.filter(wantsFacts).length}곳 · 저장 ${out.length} · 맞음 ${hit.length} · 못 찾음/먼 곳 ${out.length - hit.length} · 건너뜀 ${skipped.length}`);
console.log(`평점 ${hit.filter(([, f]) => f.rating !== undefined).length} · 요일별 운영 시간 ${hit.filter(([, f]) => f.week).length} · 소개 ${hit.filter(([, f]) => f.summary).length} · 편의 ${hit.filter(([, f]) => f.amen).length}`);
for (const [id, f] of out.filter(([, f]) => f.miss)) console.log(`  miss ${id}: ${f.miss}${f.name ? ` (${f.name})` : ""}`);
for (const [id, f] of hit.filter(([, f]) => f.status && f.status !== "OPERATIONAL")) console.log(`  ${f.status} ${id} (${f.name})`);
if (skipped.length) console.log(`  건너뜀: ${skipped.join(", ")}`);

if (!DRY) {
  for (let i = 0; i < out.length; i += 50) {
    const res = await redis(out.slice(i, i + 50).map(([id, f]) => ["HSET", "gfacts", id, JSON.stringify(f)]));
    const bad = res.filter((r) => r.error);
    if (bad.length) throw new Error(`HSET 실패 ${bad.length}건: ${bad[0].error}`);
  }
  console.log(`Redis gfacts에 ${out.length}곳 저장`);
}
