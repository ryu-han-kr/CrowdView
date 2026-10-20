"use client";

// 브라우저 쪽 Plus 도우미: 토스페이먼츠 카드 등록(자동결제) → 서버 구독, 1개월 이용권 결제창 → 서버 승인, 웹 푸시 구독
import type { PlusState } from "./plus";

/** 토스페이먼츠 'API 개별 연동 키'의 클라이언트 키 (test_ck_… / live_ck_…) */
export const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
export const checkoutEnabled = !!TOSS_CLIENT_KEY;

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

export const subscribePlus = (authKey: string, customerKey: string) => post<{ plus: PlusState }>("/api/plus/subscribe", { authKey, customerKey });
export const cancelPlus = () => post<{ plus: PlusState }>("/api/plus/cancel");
export const refundPlus = () => post<{ plus: PlusState }>("/api/plus/refund");
export const confirmPassPayment = (paymentKey: string, orderId: string, amount: number) =>
  post<{ plus: PlusState }>("/api/plus/pass", { paymentKey, orderId, amount });

/**
 * 1개월 이용권 결제창 (토스 일반 결제, 한 번만 결제). 결제가 끝나면 completeUrl로 이동하고(?paymentKey=…&orderId=…&amount=…),
 * 거기서 서버가 승인해야 결제가 끝난다. 실패·취소면 ?code=…&message=…
 */
export async function startPassPayment(user: { name: string; email?: string }, completeUrl: string): Promise<void> {
  const res = await fetch("/api/plus/pass", { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { orderId?: string; orderName?: string; amount?: number; customerKey?: string; error?: string };
  if (!res.ok || !json.orderId || !json.customerKey || !json.amount) throw new Error(json.error ?? `HTTP ${res.status}`);
  const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
  const toss = await loadTossPayments(TOSS_CLIENT_KEY!);
  await toss.payment({ customerKey: json.customerKey }).requestPayment({
    method: "CARD",
    amount: { currency: "KRW", value: json.amount },
    orderId: json.orderId,
    orderName: json.orderName ?? "CrowdView Plus",
    successUrl: completeUrl,
    failUrl: completeUrl,
    ...(user.name && { customerName: user.name }),
    ...(user.email && !user.email.endsWith("@users.crowdview.app") && { customerEmail: user.email }),
  });
}

/**
 * 토스 카드 등록창을 연다. 등록이 끝나면 completeUrl로 이동하고(?authKey=…&customerKey=…), 실패·취소면 ?code=…&message=…
 * 이동하기 때문에 돌아오는 값은 없다. 창을 닫으면 오류(USER_CANCEL)
 */
export async function startCardRegistration(user: { name: string; email?: string }, completeUrl: string): Promise<void> {
  const res = await fetch("/api/plus/subscribe", { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { customerKey?: string; error?: string };
  if (!res.ok || !json.customerKey) throw new Error(json.error ?? `HTTP ${res.status}`);
  const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
  const toss = await loadTossPayments(TOSS_CLIENT_KEY!);
  await toss.payment({ customerKey: json.customerKey }).requestBillingAuth({
    method: "CARD",
    successUrl: completeUrl,
    failUrl: completeUrl,
    ...(user.name && { customerName: user.name }),
    ...(user.email && !user.email.endsWith("@users.crowdview.app") && { customerEmail: user.email }),
  });
}

/** 웹 푸시 구독 (알림 권한 요청 포함) */
export async function getPushSubscription(): Promise<PushSubscriptionJSON> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("이 브라우저는 알림을 지원하지 않아요. (아이폰은 홈 화면에 추가한 뒤 사용할 수 있어요)");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한을 허용해 주세요");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  return sub.toJSON();
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
