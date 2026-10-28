// 해외 여행 패스 가격표 (Paddle 카탈로그 'CrowdView Travel Pass', 10/28). 결제 화면(TravelPass)과 웹훅(lib/paddle)이 함께 본다.
// 경수님 10/28: 외국인도 Plus·Pro·Max 세 단계 × 7일·30일
import type { PlanId } from "./business";

export interface Pass {
  priceId: string;
  plan: PlanId;
  days: 7 | 30;
  usd: string;
}

export const PASSES: Pass[] = [
  { priceId: "pri_01m60mtj73qt6xvc9zys1rg13g", plan: "plus", days: 7, usd: "$2.99" },
  { priceId: "pri_01m60mv9mgrxeyq51yamfx8n8g", plan: "plus", days: 30, usd: "$5.99" },
  { priceId: "pri_01m608766sry3nhj5y6eck3q3b", plan: "pro", days: 7, usd: "$3.99" },
  { priceId: "pri_01m60mvm8ert89eafrnsnrw692", plan: "pro", days: 30, usd: "$7.99" },
  { priceId: "pri_01m60mvz9h22s2ywvsnpkj1whk", plan: "max", days: 7, usd: "$5.99" },
  { priceId: "pri_01m60mw9atw55hwfem7xs986dd", plan: "max", days: 30, usd: "$11.99" },
];

/** 예전 Pro 30일($6.99) 가격 — 화면에선 팔지 않지만, 이미 열린 결제창으로 결제되면 Pro 30일로 반영 */
const LEGACY: Pass[] = [{ priceId: "pri_01m60881fypvhg2pryp2rm2j8q", plan: "pro", days: 30, usd: "$6.99" }];

export const passByPrice = (priceId: string): Pass | undefined => [...PASSES, ...LEGACY].find((p) => p.priceId === priceId);
