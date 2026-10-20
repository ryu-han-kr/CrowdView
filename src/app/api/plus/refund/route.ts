// 결제 후 7일 이내 미사용 전액 환불 (그 외 환불은 고객센터에서 처리)
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { refundWithin7Days } from "@/lib/plus";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";

export async function POST(req: Request) {
  // 결제 요청 제한: 남의 카드를 돌려 보는 시도(카드 테스트)와 실수로 여러 번 누르는 것을 막는다
  const limited = await rateLimit(req, "pay");
  if (limited) return limited;
  const user = await requireUser(req);
  if (!user) return unauthorized();
  try {
    const plus = await refundWithin7Days(user.id);
    return withPlusCookie(NextResponse.json({ plus }), plus);
  } catch (e) {
    return errorJson(e);
  }
}
