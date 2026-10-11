import { NextResponse } from "next/server";
import { deliverReport } from "@/lib/billing/notify";
import { buildCostReport } from "@/lib/billing/report";

// Vercel Cron (vercel.json, 매일 09:00 KST)이 호출. ?send=0 이면 발송 없이 JSON만 반환
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await buildCostReport();
  if (new URL(req.url).searchParams.get("send") === "0") return NextResponse.json({ report });

  const delivered = await deliverReport(report);
  const ok = Object.values(delivered).some((s) => s === "ok");
  return NextResponse.json({ report, delivered }, { status: ok ? 200 : 502 });
}
