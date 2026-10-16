// 내 정보: Plus 상태 (마이페이지·요금 페이지가 부른다). cv-plus 쿠키도 맞춰 준다
import { NextResponse } from "next/server";
import { getPlus } from "@/lib/plus";
import { requireUser, unauthorized, withPlusCookie } from "@/lib/plus-http";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const plus = await getPlus(user.id);
  return withPlusCookie(NextResponse.json({ user: { id: user.id, name: user.name }, plus }), plus);
}
