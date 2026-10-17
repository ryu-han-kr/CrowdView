// 포트원 웹훅 (콘솔 → 결제알림(Webhook) 관리 → https://crowdview.app/api/portone/webhook, V2).
// 서명을 확인한 뒤 결제 ID로 포트원에 다시 조회해서 처리한다 (본문 내용은 믿지 않는다)
import { NextResponse } from "next/server";
import { onScheduledFailed, onScheduledPaid } from "@/lib/plus";
import { opsAlert } from "@/lib/ops";
import { verifyWebhook } from "@/lib/portone";

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers)) {
    // 시크릿이 바뀌었거나 누가 흉내 낸 요청. 계속 오면 결제 연장이 멈추므로 알린다
    await opsAlert("포트원 웹훅 서명 불일치", { id: req.headers.get("webhook-id") });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(raw) as { type?: string; data?: { paymentId?: string } };
  const paymentId = event.data?.paymentId;
  try {
    if (paymentId && event.type === "Transaction.Paid") await onScheduledPaid(paymentId);
    if (paymentId && event.type === "Transaction.Failed") await onScheduledFailed(paymentId);
  } catch (e) {
    // 500을 주면 포트원이 다시 보낸다
    console.error("[portone] webhook", event.type, paymentId, e);
    await opsAlert("포트원 웹훅 처리 실패 (포트원이 다시 보냄)", { type: event.type, paymentId, error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
