// 현장 혼잡 제보 (레퍼런스: Queue-Times 'Submit queue time'). 로그인 없이 누구나, 같은 사람(IP)은 장소마다 30분에 한 번.
// 화면에 보여 줄 최근 3시간 제보는 Redis에만 두고(장소 화면이 DB를 깨우지 않게), DB에는 정확도 점검용으로 하루 한 번 모아서 넣는다
// (제보마다 DB에 쓰면 누가 계속 보낼 때 서버리스 DB가 깨어 있어 요금이 나간다).
// 도배 막기: 같은 사람 장소마다 30분에 1번 · 하루 30번, 장소마다 1시간에 40건까지
import { createHash } from "node:crypto";
import { kv } from "./cache";
import { pool, sql } from "./db";
import { PLACES } from "./places";

const WINDOW_MS = 3 * 3600_000;
const DUP_SECONDS = 30 * 60;
const PLACE_HOURLY_MAX = 40;
const IP_DAILY_MAX = 30;
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const logKey = (date: string) => `report:log:${date}`;

interface LogRow {
  placeId: string;
  level: number;
  waitMin?: number;
  userId?: string;
  ipHash: string;
  t: string;
}

export interface Report {
  /** 1 쾌적 ~ 5 매우 혼잡 */
  level: number;
  waitMin?: number;
  /** ISO 시각 */
  t: string;
}

export interface ReportSummary {
  count: number;
  /** 최근 제보 평균 단계 (반올림 전) */
  avgLevel?: number;
  /** 대기시간을 적은 제보의 평균(분) */
  avgWait?: number;
  latest?: string;
}

const listKey = (placeId: string) => `report:${placeId}`;
export const reportable = (placeId: string) => PLACES.some((p) => p.id === placeId && p.category !== "airport");

async function readList(placeId: string): Promise<Report[]> {
  try {
    const raw = await kv.get(listKey(placeId));
    const list = raw ? (JSON.parse(raw) as Report[]) : [];
    return list.filter((r) => Date.now() - Date.parse(r.t) < WINDOW_MS);
  } catch {
    return [];
  }
}

export function summarize(list: Report[]): ReportSummary {
  if (!list.length) return { count: 0 };
  const waits = list.map((r) => r.waitMin).filter((w): w is number => typeof w === "number");
  return {
    count: list.length,
    avgLevel: list.reduce((a, r) => a + r.level, 0) / list.length,
    ...(waits.length && { avgWait: Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) }),
    latest: list.at(-1)!.t,
  };
}

export const recentReports = async (placeId: string) => summarize(await readList(placeId));

/** 제보 저장. 30분 안에 같은 사람이 다시 보내면 "dup" */
export async function saveReport(
  placeId: string,
  ip: string,
  level: number,
  waitMin: number | undefined,
  userId: string | undefined,
): Promise<"ok" | "dup" | "full"> {
  const ipHash = createHash("sha256").update(`${ip}:${process.env.BETTER_AUTH_SECRET ?? "crowdview"}`).digest("hex").slice(0, 32);
  const dupKey = `report:dup:${placeId}:${ipHash}`;
  if (await kv.get(dupKey).catch(() => null)) return "dup";
  const hour = Math.floor(Date.now() / 3600_000);
  const [placeN, ipN] = await Promise.all([
    kv.incr(`report:n:${placeId}:${hour}`, 3700).catch(() => 0),
    kv.incr(`report:ip:${ipHash}:${kstDate()}`, 26 * 3600).catch(() => 0),
  ]);
  if (placeN > PLACE_HOURLY_MAX || ipN > IP_DAILY_MAX) return "full";
  await kv.set(dupKey, "1", DUP_SECONDS).catch(() => {});
  const list = [...(await readList(placeId)), { level, ...(waitMin !== undefined && { waitMin }), t: new Date().toISOString() }].slice(-50);
  await kv.set(listKey(placeId), JSON.stringify(list), WINDOW_MS / 1000).catch(() => {});
  // 정확도 점검용 하루 기록 (Redis, 3일 보관) → 새벽 수집기가 DB에 한 번에 넣는다
  const t = new Date().toISOString();
  try {
    const raw = await kv.get(logKey(kstDate()));
    const log = raw ? (JSON.parse(raw) as LogRow[]) : [];
    if (log.length < 5000) log.push({ placeId, level, ...(waitMin !== undefined && { waitMin }), ...(userId && { userId }), ipHash, t });
    await kv.set(logKey(kstDate()), JSON.stringify(log), 3 * 86_400);
  } catch {}
  return "ok";
}

/** 하루치 제보를 DB에 한 번에 넣는다 (새벽 4시 수집기). 넣은 건수 */
export async function flushReports(date: string): Promise<number> {
  if (!pool) return 0;
  const raw = await kv.get(logKey(date)).catch(() => null);
  const log = raw ? (JSON.parse(raw) as LogRow[]) : [];
  if (!log.length) return 0;
  const values: unknown[] = [];
  const rows = log.map((r, i) => {
    values.push(r.placeId, r.level, r.waitMin ?? null, r.userId ?? null, r.ipHash, r.t);
    const b = i * 6;
    // 그 사이 탈퇴한 회원이면 user_id는 비운다 (외래 키 때문에 한 건이 전체를 막지 않게)
    return `($${b + 1}, $${b + 2}::int, $${b + 3}::int, (select id from "user" where id = $${b + 4}), $${b + 5}, $${b + 6}::timestamptz)`;
  });
  await sql(`insert into crowd_report (place_id, level, wait_min, user_id, ip_hash, created_at) values ${rows.join(", ")}`, values);
  await kv.set(logKey(date), "", 1).catch(() => {});
  return log.length;
}
