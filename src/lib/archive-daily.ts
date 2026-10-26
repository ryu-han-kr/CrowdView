// 지난 날짜 기록 (사용자 10/26: 지난 데이터를 사이트에서도 보이게 + 매일 저장·관리).
// R2의 5분 원본(lib/archive, 하루 288개)을 하루 한 번 장소·서울 지역마다 한 줄(평균·최대·시간대별)로 줄여 Postgres crowd_daily에 둔다.
// - 원본은 R2에 그대로 남는다 (모델 학습·재계산용). 화면·운영 도구는 줄인 표만 읽어 빠르고 싸다
// - cron archive-daily가 매일 새벽 어제를 정리하고, 빠진 날(처음 켤 때·실패한 날)도 한 번에 몇 날씩 채운다
import { gunzipSync } from "node:zlib";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { PREFIX, archiveEnabled, s3 } from "./archive";
import { hourlyScores, parseArchiveLines, summarizeArchive } from "./archive-summary";
import { dbEnabled, sql } from "./db";
import { addDays, kst } from "./time";

const dayPrefix = (date: string) => `${PREFIX}/${date.replace(/-/g, "/")}/`;

async function listKeys(prefix: string, max = Infinity): Promise<{ key: string; size: number }[]> {
  const out: { key: string; size: number }[] = [];
  let token: string | undefined;
  do {
    const r = await s3().send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: prefix, ContinuationToken: token, MaxKeys: Math.min(1000, max) }));
    for (const o of r.Contents ?? []) if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0 });
    token = r.IsTruncated && out.length < max ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

async function getText(key: string): Promise<string> {
  const r = await s3().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  const bytes = Buffer.from(await r.Body!.transformToByteArray());
  return (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8");
}

/** 하루치 원본 → crowd_daily 줄들 저장. 저장한 줄 수 */
export async function ingestDay(date: string): Promise<{ snapshots: number; bytes: number; rows: number }> {
  const keys = await listKeys(dayPrefix(date));
  const texts: string[] = [];
  for (let i = 0; i < keys.length; i += 16) texts.push(...(await Promise.all(keys.slice(i, i + 16).map((k) => getText(k.key)))));
  const lines = parseArchiveLines(texts.join("\n"));
  const sum = summarizeArchive(lines);
  const hourly = hourlyScores(lines);
  const rows = [
    ...sum.places.map((r) => ({ kind: "place", r })),
    ...sum.seoul.map((r) => ({ kind: "seoul", r })),
  ];
  const bytes = keys.reduce((s, k) => s + k.size, 0);
  if (rows.length) {
    const params: unknown[] = [];
    const values = rows.map(({ kind, r }, i) => {
      params.push(
        kind,
        r.id,
        date,
        r.label,
        r.openN ?? r.n,
        r.avg,
        Math.round(r.max),
        r.maxAt,
        r.people?.avg ?? null,
        r.people?.max ?? null,
        hourly.get(`${kind}:${r.id}`) ?? null,
      );
      const b = i * 11;
      return `(${Array.from({ length: 11 }, (_, j) => `$${b + j + 1}`).join(",")})`;
    });
    await sql(
      `insert into crowd_daily (kind,id,date,label,samples,avg_score,max_score,max_at,avg_people,max_people,hourly) values ${values.join(",")}
       on conflict (kind,id,date) do update set label=excluded.label, samples=excluded.samples, avg_score=excluded.avg_score, max_score=excluded.max_score,
         max_at=excluded.max_at, avg_people=excluded.avg_people, max_people=excluded.max_people, hourly=excluded.hourly`,
      params,
    );
  }
  await sql(
    `insert into archive_day (date,snapshots,bytes,rows) values ($1,$2,$3,$4)
     on conflict (date) do update set snapshots=excluded.snapshots, bytes=excluded.bytes, rows=excluded.rows, done_at=now()`,
    [date, sum.snapshots, bytes, rows.length],
  );
  return { snapshots: sum.snapshots, bytes, rows: rows.length };
}

/** 아직 정리 안 한 지난 날짜 (원본 첫 날 ~ 어제), 오래된 순 */
export async function pendingDays(limit = 3): Promise<string[]> {
  const [first] = await listKeys(`${PREFIX}/`, 1);
  if (!first) return [];
  const m = first.key.match(/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (!m) return [];
  const yesterday = addDays(kst().date, -1);
  const done = new Set((await sql<{ d: string }>("select to_char(date,'YYYY-MM-DD') d from archive_day")).map((r) => r.d));
  const out: string[] = [];
  for (let d = `${m[1]}-${m[2]}-${m[3]}`; d <= yesterday && out.length < limit; d = addDays(d, 1)) if (!done.has(d)) out.push(d);
  return out;
}

export const dailyEnabled = () => archiveEnabled() && dbEnabled;

export interface DailyRow {
  date: string;
  samples: number;
  avg: number;
  max: number;
  maxAt: string;
  avgPeople: number | null;
  maxPeople: number | null;
  hourly: number[] | null;
}

/** 한 곳의 지난 날들 (최근 순) */
export async function getDaily(kind: "place" | "seoul", id: string, days = 90): Promise<DailyRow[]> {
  if (!dbEnabled) return [];
  const rows = await sql<{
    d: string;
    samples: number;
    avg_score: number;
    max_score: number;
    max_at: string;
    avg_people: number | null;
    max_people: number | null;
    hourly: number[] | null;
  }>(
    `select to_char(date,'YYYY-MM-DD') d, samples, avg_score, max_score, max_at, avg_people, max_people, hourly
       from crowd_daily where kind=$1 and id=$2 order by date desc limit $3`,
    [kind, id, days],
  ).catch(() => []);
  return rows.map((r) => ({
    date: r.d,
    samples: r.samples,
    avg: Number(r.avg_score),
    max: r.max_score,
    maxAt: r.max_at,
    avgPeople: r.avg_people,
    maxPeople: r.max_people,
    hourly: r.hourly,
  }));
}

export interface DailyIndexRow {
  kind: "place" | "seoul";
  id: string;
  label: string;
  days: number;
  last: string;
  /** 최근 7일 평균 점수 */
  recentAvg: number;
}

/** 기록이 있는 곳 목록 (지난 기록 첫 화면) */
export async function getDailyIndex(): Promise<DailyIndexRow[]> {
  if (!dbEnabled) return [];
  const rows = await sql<{ kind: "place" | "seoul"; id: string; label: string; days: string; last: string; recent: number | null }>(
    `select kind, id, max(label) label, count(*) days, to_char(max(date),'YYYY-MM-DD') last,
            avg(avg_score) filter (where date > current_date - 8) recent
       from crowd_daily group by kind, id order by kind, id`,
  ).catch(() => []);
  return rows.map((r) => ({ kind: r.kind, id: r.id, label: r.label, days: Number(r.days), last: r.last, recentAvg: Math.round(Number(r.recent ?? 0)) }));
}

export interface StorageStats {
  days: number;
  first?: string;
  last?: string;
  snapshots: number;
  rawBytes: number;
  rows: number;
  dbBytes?: number;
  dailyTableBytes?: number;
  byMonth: { month: string; days: number; snapshots: number; rawBytes: number }[];
}

/** 보관 용량 (운영 도구): R2 원본은 정리할 때 잰 크기, Postgres는 지금 크기 */
export async function storageStats(): Promise<StorageStats> {
  const empty: StorageStats = { days: 0, snapshots: 0, rawBytes: 0, rows: 0, byMonth: [] };
  if (!dbEnabled) return empty;
  const [months, size] = await Promise.all([
    sql<{ month: string; days: string; snapshots: string; bytes: string; rows: string; first: string; last: string }>(
      `select to_char(date,'YYYY-MM') month, count(*) days, sum(snapshots) snapshots, sum(bytes) bytes, sum(rows) rows,
              to_char(min(date),'YYYY-MM-DD') first, to_char(max(date),'YYYY-MM-DD') last
         from archive_day group by 1 order by 1`,
    ).catch(() => []),
    sql<{ db: string; daily: string }>(
      `select pg_database_size(current_database()) db, coalesce(pg_total_relation_size('crowd_daily'),0) daily`,
    ).catch(() => []),
  ]);
  if (!months.length) return { ...empty, dbBytes: size[0] ? Number(size[0].db) : undefined };
  return {
    days: months.reduce((s, m) => s + Number(m.days), 0),
    first: months[0].first,
    last: months.at(-1)!.last,
    snapshots: months.reduce((s, m) => s + Number(m.snapshots), 0),
    rawBytes: months.reduce((s, m) => s + Number(m.bytes), 0),
    rows: months.reduce((s, m) => s + Number(m.rows), 0),
    dbBytes: size[0] ? Number(size[0].db) : undefined,
    dailyTableBytes: size[0] ? Number(size[0].daily) : undefined,
    byMonth: months.map((m) => ({ month: m.month, days: Number(m.days), snapshots: Number(m.snapshots), rawBytes: Number(m.bytes) })),
  };
}
