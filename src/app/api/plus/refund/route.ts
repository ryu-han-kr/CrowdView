// 결제 후 7일 이내 미사용 전액 환불 (그 외 환불은 고객센터에서 처리)
import { NextResponse } from "next/server";
import { refundWithin7Days } from "@/lib/plus";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  try {
    const plus = await refundWithin7Days(user.id);
    return withPlusCookie(NextResponse.json({ plus }), plus);
  } catch (e) {
    return errorJson(e);
  }
}
