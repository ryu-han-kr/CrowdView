// 운영자 환불: POST {userId, amount?, reason} → 가장 최근 결제를 전액 또는 일부 취소
import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin";
import { opsAlert } from "@/lib/ops";
import { adminRefund } from "@/lib/plus";

export async function POST(req: Request) {
  const admin = await currentAdmin(req.headers);
  if (!admin) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { userId, amount, reason } = (await req.json().catch(() => ({}))) as { userId?: string; amount?: number; reason?: string };
  if (!userId) return NextResponse.json({ error: "userId가 없어요" }, { status: 400 });
  try {
    await adminRefund(userId, String(reason ?? "운영자 환불").slice(0, 200), amount === undefined || amount === null ? undefined : Number(amount));
    await opsAlert("운영자 환불 처리", { by: admin.email, userId, amount: amount ?? "전액", reason });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
