// 토스페이먼츠 자동결제(빌링) REST API. 결제대행사에 직접 연결한다 (중간 연동 서비스 없음).
// SDK 대신 fetch로 불러 다른 런타임·클라우드로 옮기기 쉽게 한다. 문서: https://docs.tosspayments.com/reference#자동결제
// 토스는 정기결제 예약을 해 주지 않아서, 다음 결제일은 우리 DB(next_charge_at)에 두고 10분 수집기가 결제한다 (lib/plus.ts chargeDue)
import { createHmac } from "node:crypto";

const API = "https://api.tosspayments.com/v1";

/** 키 두 개: 'API 개별 연동 키'의 클라이언트 키(브라우저)·시크릿 키(서버). 결제위젯 키로는 자동결제가 안 된다 */
export const tossEnabled = !!process.env.TOSS_SECRET_KEY && !!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

export class TossError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}

async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json",
      // 같은 키로 다시 보내면 토스가 처음 결과를 돌려준다 (네트워크 오류 후 재시도해도 두 번 결제되지 않게)
      ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  // 토스가 거절한 것(카드 한도 초과 등)만 TossError. 그 밖의 오류(시간 초과 등)는 결제됐는지 다시 조회해야 한다
  if (!res.ok) throw new TossError(json.code ?? `HTTP_${res.status}`, json.message ?? text.slice(0, 200));
  return json as T;
}

export interface TossPayment {
  paymentKey: string;
  orderId: string;
  status: "READY" | "IN_PROGRESS" | "WAITING_FOR_DEPOSIT" | "DONE" | "CANCELED" | "PARTIAL_CANCELED" | "ABORTED" | "EXPIRED";
  totalAmount: number;
  balanceAmount: number;
  approvedAt?: string;
}

/**
 * 회원마다 고정된 토스 customerKey (빌링키는 이 값에 묶인다). 회원 ID를 그대로 쓰지 않고 HMAC으로 만들어
 * 남이 추측할 수 없게 한다 (토스 권장). DB에 따로 저장하지 않아도 언제든 같은 값이 나온다
 */
export function customerKeyOf(userId: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.TOSS_SECRET_KEY ?? "";
  return `cv_${createHmac("sha256", secret).update(`toss-customer:${userId}`).digest("base64url").slice(0, 40)}`;
}

/** 카드 등록창에서 받은 authKey로 빌링키 발급 */
export function issueBillingKey(authKey: string, customerKey: string) {
  return call<{ billingKey: string; customerKey: string; card?: { number?: string; issuerCode?: string } }>("POST", "/billing/authorizations/issue", {
    authKey,
    customerKey,
  });
}

/** 빌링키로 결제 (orderId가 곧 우리 결제 ID, 6~64자 영문·숫자·-_) */
export function chargeBillingKey(
  billingKey: string,
  c: { customerKey: string; orderId: string; orderName: string; amount: number; customerEmail?: string; customerName?: string },
) {
  return call<TossPayment>("POST", `/billing/${encodeURIComponent(billingKey)}`, c, c.orderId);
}

/** 주문 번호로 결제 조회 (결제 요청이 시간 초과로 끝났을 때 실제로 결제됐는지 확인). 없으면 undefined */
export async function getPaymentByOrder(orderId: string): Promise<TossPayment | undefined> {
  try {
    return await call<TossPayment>("GET", `/payments/orders/${encodeURIComponent(orderId)}`);
  } catch (e) {
    if (e instanceof TossError && e.code === "NOT_FOUND_PAYMENT") return undefined;
    throw e;
  }
}

/** 결제 취소(환불). amount를 빼면 남은 금액 전부 */
export function cancelPayment(paymentKey: string, reason: string, amount?: number) {
  return call<TossPayment>("POST", `/payments/${encodeURIComponent(paymentKey)}/cancel`, {
    cancelReason: reason,
    ...(amount !== undefined && { cancelAmount: amount }),
  });
}

/**
 * 일반 결제 승인 (1개월 이용권). 결제창에서 돌아온 paymentKey·orderId·amount를 서버에서 토스에 확인받아야 결제가 끝난다.
 * 같은 주문 번호로 다시 보내면 토스가 처음 결과를 돌려준다 (두 번 결제되지 않게)
 */
export function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  return call<TossPayment>("POST", "/payments/confirm", { paymentKey, orderId, amount }, `confirm_${orderId}`);
}
