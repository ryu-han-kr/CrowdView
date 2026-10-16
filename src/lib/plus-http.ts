// Plus 관련 API 응답 도우미: 로그인 확인, cv-plus 쿠키 (광고 숨김 등 화면 표시용. 권한 판단은 항상 서버의 getPlus)
import { NextResponse } from "next/server";
import { currentUser } from "./auth";
import type { PlusState } from "./plus";

export async function requireUser(req: Request) {
  const user = await currentUser(req.headers);
  return user ?? null;
}

export const unauthorized = () => NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

export function withPlusCookie(res: NextResponse, plus: PlusState): NextResponse {
  if (plus.active && plus.periodEnd) {
    res.cookies.set("cv-plus", "1", { path: "/", sameSite: "lax", secure: true, expires: new Date(plus.periodEnd) });
  } else {
    res.cookies.delete("cv-plus");
  }
  return res;
}

export const errorJson = (e: unknown, status = 400) =>
  NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
