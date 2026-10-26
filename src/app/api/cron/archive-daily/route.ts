// 지난 날짜 기록 정리 (lib/archive-daily). 매시 40분: 정리 안 한 지난 날(어제·빠진 날)이 있으면 한 번에 4일까지, 없으면 목록만 보고 끝
import { NextResponse } from "next/server";
import { dailyEnabled, ingestDay, pendingDays } from "@/lib/archive-daily";
import { opsAlert } from "@/lib/ops";

export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if ((secret || process.env.VERCEL_ENV === "production") && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dailyEnabled()) return NextResponse.json({ skipped: "R2·DB 미설정" });
  const done: Record<string, unknown> = {};
  try {
    for (const date of await pendingDays(4)) done[date] = await ingestDay(date);
  } catch (e) {
    await opsAlert("지난 기록 정리 실패", e, { key: "archive-daily", cooldownS: 12 * 3600 });
    return NextResponse.json({ done, error: String(e) }, { status: 500 });
  }
  return NextResponse.json({ done });
}
