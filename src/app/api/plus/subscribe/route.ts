// Plus 구독 시작: 브라우저에서 발급받은 빌링키로 첫 달을 결제하고 다음 달을 예약한다
import { NextResponse } from "next/server";
import { opsAlert } from "@/lib/ops";
import { subscribe } from "@/lib/plus";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";
import { portoneEnabled } from "@/lib/portone";

export async function POST(req: Request) {
  if (!portoneEnabled) return NextResponse.json({ error: "결제 준비 중이에요" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const { billingKey } = (await req.json().catch(() => ({}))) as { billingKey?: string };
  if (!billingKey || typeof billingKey !== "string") return errorJson("빌링키가 없어요");
  try {
    const plus = await subscribe(user.id, billingKey);
    return withPlusCookie(NextResponse.json({ plus }), plus);
  } catch (e) {
    console.error("[plus] subscribe", user.id, e);
    await opsAlert("Plus 구독 결제 실패", { userId: user.id, error: e instanceof Error ? e.message : String(e) });
    return errorJson(e, 402);
  }
}
