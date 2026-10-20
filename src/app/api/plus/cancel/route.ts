// Plus 해지: 다음 결제 예약 취소 (남은 기간은 계속 이용)
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { opsAlert } from "@/lib/ops";
import { cancel } from "@/lib/plus";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";

export async function POST(req: Request) {
  // 결제 요청 제한: 남의 카드를 돌려 보는 시도(카드 테스트)와 실수로 여러 번 누르는 것을 막는다
  const limited = await rateLimit(req, "pay");
  if (limited) return limited;
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
