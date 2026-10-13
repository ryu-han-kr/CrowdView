import { NextResponse } from "next/server";
import { refreshAll } from "@/lib/crowd/service";

// Vercel Cron(vercel.json, 하루 1번, GET)과 Upstash QStash 예약 호출(10분, POST)이 호출한다.
// QStash는 Upstash-Forward-Authorization 헤더로 같은 Bearer 토큰을 넘긴다
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ refreshed: await refreshAll() });
}

export const POST = GET;
