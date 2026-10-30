"use client";

// 앱(TWA) 안에서만: Digital Goods API + Payment Request로 Google Play 결제 (lib/play-billing 설명)
import type { PlanId } from "./business";
import type { PlusState } from "./plus";

const PLAY_METHOD = "https://play.google.com/billing";
const TWA_KEY = "cv-twa";

type DigitalGoodsService = { consume(token: string): Promise<void> };
type WithGoods = Window & { getDigitalGoodsService?: (m: string) => Promise<DigitalGoodsService> };

/** Play 스토어 앱으로 열었는지. 첫 화면의 referrer로 알고, 이동해도 유지되게 sessionStorage에 남긴다 */
export function isTwa(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (document.referrer.startsWith("android-app://")) sessionStorage.setItem(TWA_KEY, "1");
    return sessionStorage.getItem(TWA_KEY) === "1";
  } catch {
    return document.referrer.startsWith("android-app://");
  }
}

/** Play 결제를 쓸 수 있는 앱이면 서비스, 아니면 undefined */
export async function playService(): Promise<DigitalGoodsService | undefined> {
  const w = window as WithGoods;
  if (!w.getDigitalGoodsService) return undefined;
  return w.getDigitalGoodsService(PLAY_METHOD).catch(() => undefined);
}

/** 1개월 이용권을 Play로 사고 서버 확인까지 */
export async function buyWithPlay(plan: PlanId): Promise<PlusState> {
  const service = await playService();
  if (!service) throw new Error("이 앱에서는 아직 결제할 수 없어요");
  const sku = `${plan}_1m`;
  const request = new PaymentRequest([{ supportedMethods: PLAY_METHOD, data: { sku } }], { total: { label: "Total", amount: { currency: "KRW", value: "0" } } });
  const response = await request.show();
  const { purchaseToken } = response.details as { purchaseToken: string };
  const res = await fetch("/api/plus/play", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sku, purchaseToken }) });
  const json = (await res.json().catch(() => ({}))) as { plus?: PlusState; error?: string };
  if (!res.ok || !json.plus) {
    await response.complete("fail");
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  await response.complete("success");
  // 소비해야 다음 달에 다시 살 수 있다 (소비하면 Play가 자동으로 확인 처리)
  await service.consume(purchaseToken).catch(() => {});
  return json.plus;
}
