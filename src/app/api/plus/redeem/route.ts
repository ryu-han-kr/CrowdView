// 이용 코드 입력 (마이페이지). POST { code } → Plus·Pro·Max 기간 반영
import { NextResponse } from "next/server";
import { dailyLimit, rateLimit } from "@/lib/ratelimit";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";
import { redeem } from "@/lib/redeem";

export async function POST(req: Request) {
  // 코드 맞히기 시도를 막는다: 분당 5번, 하루 10번
  const limited = await rateLimit(req, "pay");
  if (limited) return limited;
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const daily = await dailyLimit("redeem", user.id, 10);
  if (daily) return daily;
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (typeof code !== "string" || !code.trim()) return errorJson("코드를 입력해 주세요");
  try {
    const plus = await redeem(user.id, code);
    return withPlusCookie(NextResponse.json({ plus }), plus);
  } catch (e) {
    return errorJson(e);
  }
}
