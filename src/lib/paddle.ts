// 해외 결제 (Paddle, 대신 파는 결제사 MoR): 외국인 '여행 패스' 7일·30일 한 번 결제 (경수님 10/28).
// 결제창은 브라우저의 Paddle.js(클라이언트 토큰), 결제 완료는 Paddle 웹훅(transaction.completed)으로만 판단한다.
// 웹훅은 Paddle-Signature(ts·h1 = HMAC-SHA256(ts:본문, PADDLE_WEBHOOK_SECRET))로 진짜인지 확인
import crypto from "node:crypto";

/** 가격 id → 패스 일수 (Paddle 카탈로그 'CrowdView Travel Pass', 10/28 생성) */
export const PASS_PRICES: Record<string, { days: number; label: string }> = {
  [process.env.NEXT_PUBLIC_PADDLE_PRICE_7D ?? "pri_01m608766sry3nhj5y6eck3q3b"]: { days: 7, label: "7-day Travel Pass" },
  [process.env.NEXT_PUBLIC_PADDLE_PRICE_30D ?? "pri_01m60881fypvhg2pryp2rm2j8q"]: { days: 30, label: "30-day Travel Pass" },
};

export const paddleWebhookEnabled = !!process.env.PADDLE_WEBHOOK_SECRET;

/** 웹훅 서명 확인. 5분보다 오래된 서명은 거절 (같은 알림을 나중에 다시 보내는 공격 방지) */
export function verifyPaddleSignature(raw: string, header: string | null, secret = process.env.PADDLE_WEBHOOK_SECRET, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(";").map((p) => p.split("=") as [string, string]));
  const ts = Number(parts.ts);
  if (!ts || !parts.h1 || Math.abs(now / 1000 - ts) > 300) return false;
  const want = crypto.createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex");
  const a = Buffer.from(want);
  const b = Buffer.from(parts.h1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface PaddleTransaction {
  id: string;
  status: string;
  custom_data?: { userId?: string } | null;
  items?: { price?: { id?: string } | null; price_id?: string }[];
  details?: { totals?: { grand_total?: string; currency_code?: string } };
  currency_code?: string;
}

/** 결제 완료 알림에서 회원·패스 일수 꺼내기 (모르는 가격·회원 없음이면 undefined) */
export function passOf(tx: PaddleTransaction): { userId: string; days: number; priceId: string } | undefined {
  const userId = tx.custom_data?.userId;
  const priceId = tx.items?.[0]?.price?.id ?? tx.items?.[0]?.price_id;
  const pass = priceId ? PASS_PRICES[priceId] : undefined;
  if (!userId || !priceId || !pass) return undefined;
  return { userId, days: pass.days, priceId };
}
