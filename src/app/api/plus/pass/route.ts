// Plus 1개월 이용권 (한 번 결제, 자동 갱신 없음). GET: 결제창에 넘길 주문 정보, POST { paymentKey, orderId, amount }: 결제창에서 돌아온 값 승인
import { NextResponse } from "next/server";
import { dailyLimit, rateLimit } from "@/lib/ratelimit";
import { opsAlert } from "@/lib/ops";
import { confirmPass, startPass } from "@/lib/plus";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";
import { tossEnabled } from "@/lib/toss";
import { SALES_OPEN } from "@/lib/business";

export async function GET(req: Request) {
  const limited = await rateLimit(req, "pay");
  if (limited) return limited;
  if (!tossEnabled || !SALES_OPEN) return NextResponse.json({ error: "결제 준비 중이에요" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  try {
    const plan = new URL(req.url).searchParams.get("plan") === "pro" ? "pro" : "plus";
    return NextResponse.json(await startPass(user.id, plan), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorJson(e);
  }
}

export async function POST(req: Request) {
  // 결제 요청 제한: 남의 카드를 돌려 보는 시도(카드 테스트)와 실수로 여러 번 누르는 것을 막는다
  const limited = await rateLimit(req, "pay");
  if (limited) return limited;
  if (!tossEnabled) return NextResponse.json({ error: "결제 준비 중이에요" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const daily = await dailyLimit("pass", user.id, 5);
  if (daily) return daily;
  const { paymentKey, orderId, amount } = (await req.json().catch(() => ({}))) as { paymentKey?: string; orderId?: string; amount?: number };
  if (typeof paymentKey !== "string" || typeof orderId !== "string" || typeof amount !== "number") return errorJson("결제 정보가 없어요");
  try {
    const plus = await confirmPass(user.id, paymentKey, orderId, amount);
    return withPlusCookie(NextResponse.json({ plus }), plus);
  } catch (e) {
    console.error("[plus] pass", user.id, e);
    await opsAlert("Plus 이용권 결제 승인 실패", { userId: user.id, orderId, error: e instanceof Error ? e.message : String(e) });
    return errorJson(e, 402);
  }
}
