import { NextResponse } from "next/server";
import { refreshAll } from "@/lib/crowd/service";

// Vercel Cron (vercel.json, 10분 주기)이 호출
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ refreshed: await refreshAll() });
}
