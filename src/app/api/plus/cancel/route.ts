// Plus 해지: 다음 결제 예약 취소 (남은 기간은 계속 이용)
import { NextResponse } from "next/server";
import { cancel } from "@/lib/plus";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  try {
    const plus = await cancel(user.id);
    return withPlusCookie(NextResponse.json({ plus }), plus);
  } catch (e) {
    return errorJson(e, 500);
  }
}
