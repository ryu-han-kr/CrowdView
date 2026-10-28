// Plus 구독: GET은 카드 등록창에 쓸 토스 고객 키, POST는 카드 등록창에서 돌아온 authKey로 빌링키 발급 → 첫 달 결제
import { NextResponse } from "next/server";
import { asPlan } from "@/lib/business";
import { dailyLimit, rateLimit } from "@/lib/ratelimit";
import { opsAlert } from "@/lib/ops";
import { checkoutCustomerKey, subscribe } from "@/lib/plus";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";
import { tossEnabled } from "@/lib/toss";
import { SALES_OPEN } from "@/lib/business";

export async function GET(req: Request) {
  if (!tossEnabled || !SALES_OPEN) return NextResponse.json({ error: "결제 준비 중이에요" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  return NextResponse.json({ customerKey: checkoutCustomerKey(user.id) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  // 결제 요청 제한: 남의 카드를 돌려 보는 시도(카드 테스트)와 실수로 여러 번 누르는 것을 막는다
  const limited = await rateLimit(req, "pay");
  if (limited) return limited;
  if (!tossEnabled) return NextResponse.json({ error: "결제 준비 중이에요" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const daily = await dailyLimit("subscribe", user.id, 5);
  if (daily) return daily;
  const { authKey, customerKey, plan } = (await req.json().catch(() => ({}))) as { authKey?: string; customerKey?: string; plan?: string };
  if (!authKey || typeof authKey !== "string" || !customerKey || typeof customerKey !== "string") return errorJson("카드 등록 정보가 없어요");
  try {
    const plus = await subscribe(user.id, authKey, customerKey, asPlan(plan));
    return withPlusCookie(NextResponse.json({ plus }), plus);
  } catch (e) {
    console.error("[plus] subscribe", user.id, e);
    await opsAlert("Plus 구독 결제 실패", { userId: user.id, error: e instanceof Error ? e.message : String(e) });
    return errorJson(e, 402);
  }
}
