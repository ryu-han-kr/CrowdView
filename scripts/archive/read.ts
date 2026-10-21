// 보관 자료 읽기: R2(S3 호환)에서 하루치 객체(archive/crowd/YYYY/MM/DD/HHmm.ndjson.gz)를 내려받아 NDJSON 한 파일로 합치고,
// 장소별·서울 지역별 하루 요약(평균·최대·사람 수)을 표와 JSON으로 낸다. 분석의 시작점.
// 사용: npm run archive:read -- 2026-10-22            (날짜 없으면 오늘 KST)
//       npm run archive:read -- 2026-10-22 --out .archive --top 30
// 결과: .archive/2026-10-22.ndjson, .archive/2026-10-22.summary.json (.archive/는 커밋하지 않는다)
// 환경변수: R2_ACCOUNT_ID·R2_ACCESS_KEY_ID·R2_SECRET_ACCESS_KEY·R2_BUCKET (.env.local 또는 환경변수). 값은 출력하지 않는다
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { formatSummaryTable, parseArchiveLines, summarizeArchive } from "../../src/lib/archive-summary";

if (!process.env.R2_ACCOUNT_ID && fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const todayKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? todayKst;
const outDir = opt("out", ".archive");
const top = Number(opt("top", "20"));

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("R2 환경변수(R2_ACCOUNT_ID·R2_ACCESS_KEY_ID·R2_SECRET_ACCESS_KEY·R2_BUCKET)가 없어요. .env.local에 넣거나 `vercel env pull`.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});
const prefix = `archive/crowd/${date.replace(/-/g, "/")}/`;

async function listKeys(): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents ?? []) if (o.Key) keys.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys.sort();
}

async function getText(key: string): Promise<string> {
  const r = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  const bytes = Buffer.from(await r.Body!.transformToByteArray());
  // 저장할 때 gzip 본문 + ContentEncoding: gzip. 클라이언트가 이미 풀어 줬으면 그대로
  return (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8");
}

/** 동시에 n개씩 */
async function mapLimit<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, xs.length) }, async () => {
      while (i < xs.length) {
        const j = i++;
        out[j] = await fn(xs[j]);
      }
    }),
  );
  return out;
}

const main = async () => {
  const keys = await listKeys();
  if (!keys.length) {
    console.log(`${date}: 객체가 없어요 (${prefix}). 보관은 R2 환경변수를 넣은 뒤부터 쌓여요.`);
    return;
  }
  console.log(`${date}: 객체 ${keys.length}개 내려받는 중…`);
  const texts = await mapLimit(keys, 8, getText);
  fs.mkdirSync(outDir, { recursive: true });
  const merged = texts.map((t) => (t.endsWith("\n") ? t : t + "\n")).join("");
  const ndjson = path.join(outDir, `${date}.ndjson`);
  fs.writeFileSync(ndjson, merged);

  const summary = summarizeArchive(parseArchiveLines(merged));
  const summaryPath = path.join(outDir, `${date}.summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify({ date, objects: keys.length, ...summary }, null, 2));

  const kst = (iso?: string) => (iso ? new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(11, 16) : "-");
  console.log(`\n스냅샷 ${summary.snapshots}개 · ${kst(summary.from)}~${kst(summary.to)} KST · 줄 ${merged.split("\n").length - 1}개`);
  console.log(`\n[장소 ${summary.places.length}곳 · 최대 점수 순] (스냅샷은 문 연 것/전체, 평균은 문 연 것만)`);
  console.log(formatSummaryTable(summary.places, top));
  console.log(`\n[서울 지역 ${summary.seoul.length}곳 · 최대 점수 순] (사람 수는 서울시 범위의 가운데 값)`);
  console.log(formatSummaryTable(summary.seoul, top));
  console.log(`\n저장: ${ndjson}, ${summaryPath}`);
};

main().catch((e) => {
  console.error("실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
