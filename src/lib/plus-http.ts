// Plus 관련 API 응답 도우미: 로그인 확인, cv-plus 쿠키 (광고 숨김 등 화면 표시용. 권한 판단은 항상 서버의 getPlus)
import { NextResponse } from "next/server";
import { currentUser } from "./auth";
import { TossError } from "./toss";
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

/**
 * 오류 응답. 우리가 사용자에게 보여 주려고 만든 한국어 문장·토스 거절 사유만 그대로 보내고,
 * 그 밖의 내부 오류(DB·네트워크 등 영어 메시지)는 감춘다 (QA 10/21: 내부 오류 노출 방지)
 */
export const errorJson = (e: unknown, status = 400) => {
  const msg = e instanceof Error ? e.message : String(e);
  const safe = e instanceof TossError || /[가-힣]/.test(msg);
  if (!safe) console.error("[api]", msg);
  return NextResponse.json({ error: safe ? msg : "잠시 뒤 다시 시도해 주세요" }, { status });
};
