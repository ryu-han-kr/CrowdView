// 운영자 해지: POST {userId} → 다음 결제 예약 취소 (남은 기간은 이용)
import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin";
import { opsAlert } from "@/lib/ops";
import { adminCancel } from "@/lib/plus";

export async function POST(req: Request) {
  const admin = await currentAdmin(req.headers);
  if (!admin) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "userId가 없어요" }, { status: 400 });
  try {
    await adminCancel(userId);
    await opsAlert("운영자 해지 처리", { by: admin.email, userId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
