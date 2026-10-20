// 현장 혼잡 제보 (레퍼런스: Queue-Times 'Submit queue time'). 로그인 없이 누구나, 같은 사람(IP)은 장소마다 30분에 한 번.
// 화면에 보여 줄 최근 3시간 제보는 Redis에만 두고(장소 화면이 DB를 깨우지 않게), DB에는 정확도 점검용으로 쌓는다.
import { createHash } from "node:crypto";
import { kv } from "./cache";
import { pool, sql } from "./db";
import { PLACES } from "./places";

const WINDOW_MS = 3 * 3600_000;
const DUP_SECONDS = 30 * 60;

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
): Promise<"ok" | "dup"> {
  const ipHash = createHash("sha256").update(`${ip}:${process.env.BETTER_AUTH_SECRET ?? "crowdview"}`).digest("hex").slice(0, 32);
  const dupKey = `report:dup:${placeId}:${ipHash}`;
  if (await kv.get(dupKey).catch(() => null)) return "dup";
  await kv.set(dupKey, "1", DUP_SECONDS).catch(() => {});
  const list = [...(await readList(placeId)), { level, ...(waitMin !== undefined && { waitMin }), t: new Date().toISOString() }].slice(-50);
  await kv.set(listKey(placeId), JSON.stringify(list), WINDOW_MS / 1000).catch(() => {});
  if (pool)
    await sql("insert into crowd_report (place_id, level, wait_min, user_id, ip_hash) values ($1, $2, $3, $4, $5)", [
      placeId,
      level,
      waitMin ?? null,
      userId ?? null,
      ipHash,
    ]).catch((e) => console.warn("[report] db", e instanceof Error ? e.message : e));
  return "ok";
}
