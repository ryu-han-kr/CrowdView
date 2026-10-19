// Plus 구독: GET은 카드 등록창에 쓸 토스 고객 키, POST는 카드 등록창에서 돌아온 authKey로 빌링키 발급 → 첫 달 결제
import { NextResponse } from "next/server";
import { opsAlert } from "@/lib/ops";
import { checkoutCustomerKey, subscribe } from "@/lib/plus";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";
import { tossEnabled } from "@/lib/toss";

export async function GET(req: Request) {
  if (!tossEnabled) return NextResponse.json({ error: "결제 준비 중이에요" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  return NextResponse.json({ customerKey: checkoutCustomerKey(user.id) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!tossEnabled) return NextResponse.json({ error: "결제 준비 중이에요" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const { authKey, customerKey } = (await req.json().catch(() => ({}))) as { authKey?: string; customerKey?: string };
  if (!authKey || typeof authKey !== "string" || !customerKey || typeof customerKey !== "string") return errorJson("카드 등록 정보가 없어요");
  try {
    const plus = await subscribe(user.id, authKey, customerKey);
    return withPlusCookie(NextResponse.json({ plus }), plus);
  } catch (e) {
    console.error("[plus] subscribe", user.id, e);
    await opsAlert("Plus 구독 결제 실패", { userId: user.id, error: e instanceof Error ? e.message : String(e) });
    return errorJson(e, 402);
  }
}
