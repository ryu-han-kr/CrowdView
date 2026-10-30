// 앱(Play 스토어 TWA) 안 결제 = Google Play 결제 (경수님 10/30: 웹은 토스, 앱은 Play 결제). Play 정책상 앱 안 디지털 상품은 Play 결제만 쓴다.
// 상품: Play Console '인앱 상품'(일회성, 소비형) plus_1m·pro_1m·max_1m = 1개월 이용권. 앱이 산 뒤 구매 토큰을 보내면
// 서버가 Google Play Developer API로 확인하고 30일을 붙인다 (grantDays, 같은 주문은 한 번만).
// 필요: GOOGLE_PLAY_SERVICE_ACCOUNT (서비스 계정 JSON, Play Console '사용자 및 권한'에서 '재무 데이터 보기·주문 관리' 권한)
import { createSign } from "node:crypto";
import type { PlanId } from "./business";

export const PLAY_PACKAGE = process.env.ANDROID_PACKAGE ?? "app.crowdview.twa";
export const PLAY_SKUS: Record<string, PlanId> = { plus_1m: "plus", pro_1m: "pro", max_1m: "max" };
export const playSkuOf = (plan: PlanId) => `${plan}_1m`;
export const playBillingServer = () => !!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

const b64url = (x: string | Buffer) => Buffer.from(x).toString("base64url");

/** 서비스 계정으로 OAuth 토큰 (androidpublisher 범위) */
async function accessToken(): Promise<string> {
  const sa = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT ?? "{}") as ServiceAccount;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }),
  );
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }),
  });
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("Play 결제 확인 연결에 실패했어요");
  return j.access_token;
}

export interface PlayPurchase {
  orderId: string;
  /** 0 구매됨 · 1 취소 · 2 대기 */
  purchaseState: number;
  acknowledgementState: number;
  consumptionState: number;
}

/** 구매 토큰 확인. 결제가 끝난 것만 돌려준다 */
export async function verifyPlayPurchase(sku: string, token: string): Promise<PlayPurchase> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) throw new Error("Google Play 결제를 확인하지 못했어요");
  const p = (await res.json()) as PlayPurchase;
  if (p.purchaseState !== 0) throw new Error(p.purchaseState === 2 ? "결제가 아직 끝나지 않았어요. 잠시 뒤 다시 확인해 주세요" : "취소된 결제예요");
  return p;
}
