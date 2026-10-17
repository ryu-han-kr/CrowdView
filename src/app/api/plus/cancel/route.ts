// Plus 해지: 다음 결제 예약 취소 (남은 기간은 계속 이용)
import { NextResponse } from "next/server";
import { opsAlert } from "@/lib/ops";
import { cancel } from "@/lib/plus";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  try {
    const plus = await cancel(user.id);
    return withPlusCookie(NextResponse.json({ plus }), plus);
  } catch (e) {
    // 해지가 실패하면 다음 달에 원치 않는 결제가 나갈 수 있어 바로 확인해야 한다
    await opsAlert("Plus 해지 실패", { userId: user.id, error: e instanceof Error ? e.message : String(e) });
    return errorJson(e, 500);
  }
}
