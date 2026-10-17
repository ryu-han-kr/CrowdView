// 실사용 화면 속도 보고 (components/WebVitals, 10% 표본). 요청 제한은 오류 보고와 같은 묶음
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { recordVitals } from "@/lib/vitals";

export async function POST(req: Request) {
  const limited = await rateLimit(req, "log");
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { metrics?: unknown };
  const metrics = (Array.isArray(body.metrics) ? body.metrics : []).filter(
    (x): x is { n: string; r: string } => typeof x?.n === "string" && typeof x?.r === "string",
  );
  return NextResponse.json({ recorded: await recordVitals(metrics) });
}
