// 앱 안 Google Play 결제 확인 (lib/play-billing). POST { sku, purchaseToken } → 30일 이용권
import { NextResponse } from "next/server";
import { PLANS } from "@/lib/business";
import { PLAY_SKUS, playBillingServer, verifyPlayPurchase } from "@/lib/play-billing";
import { grantDays } from "@/lib/plus";
import { errorJson, requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const limited = await rateLimit(req, "pay");
  if (limited) return limited;
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (!playBillingServer()) return errorJson("앱 결제를 준비하고 있어요", 503);
  const { sku, purchaseToken } = (await req.json().catch(() => ({}))) as { sku?: string; purchaseToken?: string };
  const plan = typeof sku === "string" ? PLAY_SKUS[sku] : undefined;
  if (!plan || typeof purchaseToken !== "string" || !purchaseToken) return errorJson("잘못된 결제 요청이에요");
  try {
    const p = await verifyPlayPurchase(sku!, purchaseToken);
    // 같은 주문은 한 번만 (grantDays가 id로 막는다). 금액은 원화 정가로 기록 (Play 수수료 전)
    const plus = await grantDays(user.id, `play:${p.orderId}`, 30, plan, PLANS[plan].priceKrw, { sku, orderId: p.orderId });
    return withPlusCookie(NextResponse.json({ plus }), plus);
  } catch (e) {
    return errorJson(e);
  }
}
