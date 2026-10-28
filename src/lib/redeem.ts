// 이용 코드 (경수님 10/28: 결제 없이 Plus·Pro를 쓰게 하는 코드 — 운영자 본인·테스터·이벤트용).
// 코드 목록은 환경변수 REDEEM_CODES: "코드:단계:일수:최대사용수" 를 쉼표로 (예: CV-PRO-XXXX:pro:365:1,CV-PLUS-YYYY:plus:30:20)
// 사용 기록은 결제 기록(payment)에 금액 0으로 남긴다 (id = redeem:코드:회원) → 한 회원은 같은 코드를 한 번만
import { sql } from "./db";
import type { PlanId } from "./business";
import { grantDays, type PlusState } from "./plus";

export interface RedeemCode {
  code: string;
  plan: PlanId;
  days: number;
  maxUses: number;
}

export function parseCodes(env = process.env.REDEEM_CODES ?? ""): RedeemCode[] {
  return env
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [code, plan, days, max] = x.split(":");
      return { code: code.toUpperCase(), plan: plan === "pro" ? "pro" : "plus", days: Number(days) || 30, maxUses: Number(max) || 1 } as RedeemCode;
    })
    .filter((c) => c.code.length >= 6);
}

/** 코드를 쓰고 바뀐 Plus 상태. 틀린 코드·다 쓴 코드는 한국어 오류 */
export async function redeem(userId: string, input: string): Promise<PlusState> {
  const code = input.trim().toUpperCase();
  const c = parseCodes().find((x) => x.code === code);
  if (!c) throw new Error("없는 코드예요. 다시 확인해 주세요");
  const prefix = `redeem:${c.code}:`;
  const [{ n }] = await sql<{ n: number }>("select count(*)::int as n from payment where id like $1", [`${prefix}%`]);
  const mine = await sql("select 1 from payment where id = $1", [prefix + userId]);
  if (mine.length) throw new Error("이미 쓴 코드예요");
  if (n >= c.maxUses) throw new Error("사용 횟수가 끝난 코드예요");
  return grantDays(userId, prefix + userId, c.days, c.plan, 0, { redeem: c.code, plan: c.plan, days: c.days });
}
