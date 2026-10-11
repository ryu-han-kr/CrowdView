import { NextResponse } from "next/server";
import { deliverReport } from "@/lib/billing/notify";
import { renderReportPdf, reportFilename } from "@/lib/billing/pdf";
import { buildCostReport } from "@/lib/billing/report";

// Vercel Cron (vercel.json, 매일 09:00 KST)이 호출.
// ?send=0 이면 발송 없이 JSON, ?format=pdf 면 발송 없이 PDF를 그대로 반환
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const report = await buildCostReport();

  if (params.get("format") === "pdf") {
    return new Response(Buffer.from(await renderReportPdf(report)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${reportFilename(report)}"`,
      },
    });
  }
  if (params.get("send") === "0") return NextResponse.json({ report });

  const delivered = await deliverReport(report);
  const ok = Object.values(delivered).some((s) => s === "ok");
  return NextResponse.json({ report, delivered }, { status: ok ? 200 : 502 });
}
