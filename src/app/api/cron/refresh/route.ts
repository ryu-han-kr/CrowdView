import { NextResponse } from "next/server";
import { refreshAll } from "@/lib/crowd/service";

// Vercel Cron(vercel.json, 10분마다, GET)이 Authorization: Bearer CRON_SECRET 헤더로 호출한다.
// 다른 클라우드로 옮기면 그쪽 스케줄러가 같은 헤더를 붙여 GET 또는 POST로 부르면 된다
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ refreshed: await refreshAll() });
}

export const POST = GET;
