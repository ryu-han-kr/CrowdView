import { NextResponse } from "next/server";
import { checkAlerts } from "@/lib/alerts";
import { getAllCrowd, refreshAll } from "@/lib/crowd/service";
import { expireEnded } from "@/lib/plus";
import { kst } from "@/lib/time";

// Vercel Cron(vercel.json, 10분마다, GET)이 Authorization: Bearer CRON_SECRET 헤더로 호출한다.
// 다른 클라우드로 옮기면 그쪽 스케줄러가 같은 헤더를 붙여 GET 또는 POST로 부르면 된다
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const refreshed = await refreshAll();
  // 새 혼잡도로 Plus 혼잡 알림을 보내고, 기간이 끝난 해지 구독을 정리한다 (DB가 없으면 건너뜀)
  const alerts = await checkAlerts(await getAllCrowd()).catch((e) => (console.error("[cron] alerts", e), 0));
  // 만료 정리는 하루 한 번 (새벽 4시 첫 수집)이면 충분 — 매번 돌리면 DB가 계속 깨어 있다
  const now = kst();
  const expired =
    Math.floor(now.hour) === 4 && (now.hour % 1) * 60 < 10 ? await expireEnded().catch((e) => (console.error("[cron] expire", e), 0)) : 0;
  return NextResponse.json({ refreshed, alerts, expired });
}

export const POST = GET;
