// Paddle 웹훅 (해외 여행 패스). Paddle 대시보드 Developer tools → Notifications 에 이 주소를 넣고
// 이벤트 transaction.completed 를 고른다. 비밀값(Secret key)은 PADDLE_WEBHOOK_SECRET
import { NextResponse } from "next/server";
import { opsAlert } from "@/lib/ops";
import { passOf, verifyPaddleSignature, type PaddleTransaction } from "@/lib/paddle";
import { grantTravelPass } from "@/lib/plus";

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyPaddleSignature(raw, req.headers.get("paddle-signature"))) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  let event: { event_type?: string; data?: PaddleTransaction };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  // 결제 완료만 처리하고, 나머지 알림은 받았다고만 답한다 (Paddle이 다시 보내지 않게)
  if (event.event_type !== "transaction.completed" || !event.data) return NextResponse.json({ ok: true });
  const tx = event.data;
  const pass = passOf(tx);
  if (!pass) {
    await opsAlert("Paddle 결제: 회원·가격을 알 수 없음", { tx: tx.id });
    return NextResponse.json({ ok: true });
  }
  try {
    const amount = Number(tx.details?.totals?.grand_total ?? 0);
    await grantTravelPass(pass.userId, tx.id, pass.days, Number.isFinite(amount) ? amount : 0, tx);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // 500이면 Paddle이 나중에 다시 보낸다 (같은 거래는 한 번만 반영)
    await opsAlert("Paddle 여행 패스 반영 실패", { tx: tx.id, error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
