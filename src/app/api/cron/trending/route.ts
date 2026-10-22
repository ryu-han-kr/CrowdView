// 요즘 뜨는 곳 계산 (lib/trending). 매시 15분에 불려 오늘 계산이 아직이면(6시 이후) 계산한다.
// AI 웹 검색이 몇 분 걸릴 수 있어 5분 수집기와 따로 둔다
import { NextResponse } from "next/server";
import { opsAlert } from "@/lib/ops";
import { kst } from "@/lib/time";
import { refreshTrending, trendingDue } from "@/lib/trending";

export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if ((secret || process.env.VERCEL_ENV === "production") && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && !(await trendingDue(kst().hour))) return NextResponse.json({ skipped: true });
  const n = await refreshTrending().catch(async (e) => (await opsAlert("요즘 뜨는 곳 계산 실패", e, { key: "trending", cooldownS: 6 * 3600 }), 0));
  return NextResponse.json({ items: n });
}
