// 포트원 V2 REST API (결제: 토스페이먼츠 채널). SDK 대신 fetch로 불러 다른 런타임·클라우드로 옮기기 쉽게 한다.
// 문서: https://developers.portone.io (빌링키 결제·결제 예약·웹훅)
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.portone.io";

export const portoneEnabled = !!process.env.PORTONE_API_SECRET && !!process.env.NEXT_PUBLIC_PORTONE_STORE_ID;

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new PortOneError(json.type ?? `HTTP_${res.status}`, json.message ?? text.slice(0, 200));
  return json as T;
}

export class PortOneError extends Error {
  constructor(
    public type: string,
    message: string,
  ) {
    super(`${type}: ${message}`);
  }
}

export interface PortOnePayment {
  id: string;
  status: "READY" | "PENDING" | "VIRTUAL_ACCOUNT_ISSUED" | "PAID" | "FAILED" | "PARTIAL_CANCELLED" | "CANCELLED";
  amount: { total: number; paid?: number; cancelled?: number };
  paidAt?: string;
  billingKey?: string;
  customer?: { id?: string };
  failure?: { reason?: string };
}

interface Charge {
  billingKey: string;
  orderName: string;
  amount: number;
  customerId: string;
}

const chargeBody = (c: Charge) => ({
  storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
  billingKey: c.billingKey,
  orderName: c.orderName,
  customer: { id: c.customerId },
  amount: { total: c.amount },
  currency: "KRW",
});

/** 빌링키로 바로 결제 */
export function payWithBillingKey(paymentId: string, c: Charge) {
  return call<{ payment?: { pgTxId?: string; paidAt?: string } }>("POST", `/payments/${encodeURIComponent(paymentId)}/billing-key`, chargeBody(c));
}

/** 정해진 시각에 결제 예약 (예약 ID를 돌려준다) */
export async function schedulePayment(paymentId: string, c: Charge, timeToPay: Date): Promise<string | undefined> {
  const res = await call<{ schedule?: { id?: string } }>("POST", `/payments/${encodeURIComponent(paymentId)}/schedule`, {
    payment: chargeBody(c),
    timeToPay: timeToPay.toISOString(),
  });
  return res.schedule?.id;
}

/** 결제 예약 취소 */
export function cancelSchedules(billingKey: string, scheduleIds: string[]) {
  return call("DELETE", "/payment-schedules", { storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID, billingKey, scheduleIds });
}

/** 결제 단건 조회 (웹훅을 받으면 반드시 다시 조회해서 상태를 확인한다) */
export function getPayment(paymentId: string) {
  return call<PortOnePayment>("GET", `/payments/${encodeURIComponent(paymentId)}?storeId=${process.env.NEXT_PUBLIC_PORTONE_STORE_ID}`);
}

/** 결제 취소(환불). amount를 빼면 전액 */
export function cancelPayment(paymentId: string, reason: string, amount?: number) {
  return call("POST", `/payments/${encodeURIComponent(paymentId)}/cancel`, {
    storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
    reason,
    ...(amount !== undefined && { amount }),
  });
}

/** 빌링키 삭제 (구독이 끝나면 카드 정보를 남기지 않는다) */
export function deleteBillingKey(billingKey: string) {
  return call("DELETE", `/billing-keys/${encodeURIComponent(billingKey)}?storeId=${process.env.NEXT_PUBLIC_PORTONE_STORE_ID}`);
}

/**
 * 웹훅 서명 확인 (Standard Webhooks: webhook-id, webhook-timestamp, webhook-signature 헤더).
 * 서명 = base64(HMAC-SHA256(시크릿, "{id}.{timestamp}.{원문}")), 5분 넘게 지난 요청은 거절
 */
export function verifyWebhook(rawBody: string, headers: Headers): boolean {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigs = headers.get("webhook-signature");
  if (!secret || !id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = /^[A-Za-z0-9+/=]+$/.test(raw) ? Buffer.from(raw, "base64") : Buffer.from(raw);
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest();
  return sigs.split(" ").some((s) => {
    const [, b64] = s.split(",");
    const got = b64 ? Buffer.from(b64, "base64") : Buffer.alloc(0);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
