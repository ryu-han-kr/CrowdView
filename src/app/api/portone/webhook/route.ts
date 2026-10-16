// 포트원 웹훅 (콘솔 → 결제알림(Webhook) 관리 → https://crowdview.app/api/portone/webhook, V2).
// 서명을 확인한 뒤 결제 ID로 포트원에 다시 조회해서 처리한다 (본문 내용은 믿지 않는다)
import { NextResponse } from "next/server";
import { onScheduledFailed, onScheduledPaid } from "@/lib/plus";
import { verifyWebhook } from "@/lib/portone";

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers)) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  const event = JSON.parse(raw) as { type?: string; data?: { paymentId?: string } };
  const paymentId = event.data?.paymentId;
  try {
    if (paymentId && event.type === "Transaction.Paid") await onScheduledPaid(paymentId);
    if (paymentId && event.type === "Transaction.Failed") await onScheduledFailed(paymentId);
  } catch (e) {
    // 500을 주면 포트원이 다시 보낸다
    console.error("[portone] webhook", event.type, paymentId, e);
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
