"use client";

// 브라우저 쪽 Plus 도우미: 포트원 빌링키 발급 → 서버 구독, 웹 푸시 구독
import type { PlusState } from "./plus";

export const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
export const PORTONE_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
export const checkoutEnabled = !!PORTONE_STORE_ID && !!PORTONE_CHANNEL_KEY;

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

export const subscribePlus = (billingKey: string) => post<{ plus: PlusState }>("/api/plus/subscribe", { billingKey });
export const cancelPlus = () => post<{ plus: PlusState }>("/api/plus/cancel");
export const refundPlus = () => post<{ plus: PlusState }>("/api/plus/refund");

/**
 * 카드 등록(빌링키 발급) 창을 띄운다. PC는 창 안에서 끝나 빌링키를 돌려주고,
 * 모바일은 completeUrl로 이동했다가 돌아온다 (/plus/complete 가 마무리)
 */
export async function issueBillingKey(user: { id: string; name: string; email?: string }, completeUrl: string): Promise<string> {
  const PortOne = await import("@portone/browser-sdk/v2");
  const res = await PortOne.requestIssueBillingKey({
    storeId: PORTONE_STORE_ID!,
    channelKey: PORTONE_CHANNEL_KEY!,
    billingKeyMethod: "CARD",
    issueId: `issue_${user.id.slice(0, 12)}_${Date.now().toString(36)}`,
    issueName: "CrowdView Plus 정기결제 카드 등록",
    customer: {
      customerId: user.id,
      ...(user.name && { fullName: user.name }),
      ...(user.email && !user.email.endsWith("@users.crowdview.app") && { email: user.email }),
    },
    redirectUrl: completeUrl,
  });
  if (!res) throw new Error("결제 창이 닫혔어요");
  if (res.code) throw new Error(res.message ?? res.code);
  return res.billingKey;
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
