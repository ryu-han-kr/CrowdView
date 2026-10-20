// 현장 혼잡 제보. GET ?placeId= → 최근 3시간 요약, POST { placeId, level(1~5), waitMin? } → 저장 (같은 사람 30분에 한 번)
import { NextResponse } from "next/server";
import { recentReports, reportable, saveReport } from "@/lib/crowd-report";
import { currentUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const placeId = new URL(req.url).searchParams.get("placeId") ?? "";
  if (!reportable(placeId)) return NextResponse.json({ error: "없는 장소예요" }, { status: 404 });
  return NextResponse.json(await recentReports(placeId), { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const limited = await rateLimit(req, "report");
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { placeId?: string; level?: number; waitMin?: number };
  const level = Number(body.level);
  const wait = body.waitMin === undefined || body.waitMin === null ? undefined : Math.round(Number(body.waitMin));
  if (!body.placeId || !reportable(body.placeId) || !Number.isInteger(level) || level < 1 || level > 5)
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  if (wait !== undefined && !(wait >= 0 && wait <= 300)) return NextResponse.json({ error: "대기시간은 0~300분" }, { status: 400 });
  const user = await currentUser(req.headers).catch(() => null);
  const result = await saveReport(body.placeId, clientIp(req), level, wait, user?.id);
  if (result === "dup") return NextResponse.json({ error: "이 장소는 30분 뒤에 다시 알려 주세요" }, { status: 429 });
  return NextResponse.json(await recentReports(body.placeId));
}
