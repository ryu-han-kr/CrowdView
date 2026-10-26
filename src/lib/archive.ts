// 자료 보관: 수집기가 돌 때마다 지금 혼잡도(장소 32곳)와 서울 121곳 실시간 인구를 한 덩어리(NDJSON.gz)로 Cloudflare R2에 둔다.
// 원천 API들은 '지금 값'만 주고 이력이 없어서, 나중에 모델을 배우거나 정확도를 되짚으려면 우리가 쌓아 둬야 한다 (사용자 결정 10/21: R2).
// - 5분마다 한 객체 (archive/crowd/YYYY/MM/DD/HHmm.ndjson.gz, 줄마다 {kind, at, ...}). 하루 약 288개·3MB, 1년 약 1.1GB
// - S3 호환 API라 R2 → S3·MinIO로 옮겨도 endpoint만 바꾸면 된다 (직접 운영 서버로 가는 설계)
// - 환경변수(R2_ACCOUNT_ID·R2_ACCESS_KEY_ID·R2_SECRET_ACCESS_KEY·R2_BUCKET)가 없으면 아무것도 하지 않는다
// 읽기: `npm run archive:read -- YYYY-MM-DD` (scripts/archive/read.ts: 하루치 내려받아 NDJSON 합치기 + 장소별·지역별 요약) 또는 rclone/aws cli·R2 대시보드
import { gzipSync } from "node:zlib";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { kv } from "./cache";
import type { SeoulLive } from "./seoul-live";
import type { CrowdResult } from "./types";

const LAST_KEY = "archive:last";
export const PREFIX = "archive/crowd";

export const archiveEnabled = () =>
  !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);

let client: S3Client | undefined;
export function s3(): S3Client {
  return (client ??= new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  }));
}

/** 객체 키: KST 날짜 폴더 + 시각 (예: archive/crowd/2026/10/21/2135.ndjson.gz) */
export function archiveKey(at: Date): string {
  const k = new Date(at.getTime() + 9 * 3600_000).toISOString();
  return `${PREFIX}/${k.slice(0, 4)}/${k.slice(5, 7)}/${k.slice(8, 10)}/${k.slice(11, 13)}${k.slice(14, 16)}.ndjson.gz`;
}

type Live = Record<string, Omit<SeoulLive, "distance">>;

/** 순수 계산: 한 번 수집한 것 → NDJSON 줄들. 화면용 시간대 곡선(hourly)은 모델값이 섞여 있어 빼고, 실측·구역·관측 시각만 남긴다 */
export function archiveLines(crowd: Record<string, CrowdResult>, seoul: Live, at: Date): string[] {
  const iso = at.toISOString();
  const lines: string[] = [];
  for (const c of Object.values(crowd)) {
    const { hourly: _hourly, stale: _stale, ageMinutes: _age, ...rest } = c;
    lines.push(JSON.stringify({ kind: "place", at: iso, ...rest }));
  }
  for (const [code, l] of Object.entries(seoul)) {
    lines.push(JSON.stringify({ kind: "seoul", at: iso, code, ...l }));
  }
  return lines;
}

/** 수집기에서: 지금 상태를 R2에 한 객체로. 저장한 줄 수 (꺼져 있거나 실패하면 0, 실패는 호출 쪽에서 알림) */
export async function archiveSnapshot(crowd: Record<string, CrowdResult>, seoul: Live, at = new Date()): Promise<number> {
  if (!archiveEnabled()) return 0;
  const lines = archiveLines(crowd, seoul, at);
  if (!lines.length) return 0;
  const key = archiveKey(at);
  await s3().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: gzipSync(Buffer.from(lines.join("\n") + "\n", "utf8")),
      ContentType: "application/x-ndjson",
      ContentEncoding: "gzip",
    }),
  );
  await kv.set(LAST_KEY, JSON.stringify({ key, at: at.toISOString(), lines: lines.length }), 3 * 86_400).catch(() => {});
  return lines.length;
}

/** 마지막으로 저장한 객체 (health 표시용) */
export async function archiveStatus(): Promise<{ enabled: boolean; last?: { key: string; at: string; lines: number } }> {
  const raw = await kv.get(LAST_KEY).catch(() => null);
  return { enabled: archiveEnabled(), ...(raw ? { last: JSON.parse(raw) } : {}) };
}
