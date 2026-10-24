// 광고·제휴 기대수익 계산 (사용자 10/24). 실제 돈이 집계되는 방식에 맞춰 단위를 나눈다:
// - 애드센스: 광고가 '채워져 보인' 횟수 1,000번당 금액(노출 RPM) + 클릭. 같은 사람이 하루에 여러 번 와도 페이지를 볼 때마다 따로 센다.
//   다만 구글이 무효 트래픽(같은 사람의 반복 새로고침·클릭, 봇)을 걸러 깎고, 내가 누르면 계정 정지 → 숫자는 '걸러진 뒤' 기준으로 낮게 잡는다
// - 제휴(숙소·투어): 클릭이 아니라 '실제로 묵은/이용한 예약'에만 수수료. 마지막 클릭 기준, 쿠키 기간(숙소 약 7일·투어 30일) 안 예약만,
//   취소되면 빠지고, 정산은 이용 다음 달 → 클릭 × 예약 전환율 × 평균 결제액 × 수수료율
// 값은 처음 잡은 가정이라 실제 애드센스·제휴 보고서가 쌓이면 바꾼다 (원 단위)
import { isAffiliate } from "./affiliate";
import type { DayTraffic } from "./traffic";

/** 언어별 광고 노출 1,000번당 금액(원). 한국 모바일 여행 정보 사이트 기준으로 낮게, 영어권은 단가가 높다 */
export const AD_IMPRESSION_RPM: Record<string, number> = { ko: 700, en: 2500, ja: 1500, "zh-CN": 500, "zh-TW": 800, other: 800 };
/** 광고가 아직 안 붙은 날, 페이지뷰로 미리 보는 값: 페이지당 광고 칸 수 × 채워지는 비율 */
export const ADS_PER_PAGE = 1;
export const FILL_RATE = 0.8;

/** 제휴: 클릭 → 실제 이용 예약 비율, 평균 결제액, 수수료율 */
export const AFFILIATE: Record<"stay" | "tour", { conversion: number; avgOrder: number; commission: number }> = {
  stay: { conversion: 0.015, avgOrder: 150_000, commission: 0.04 },
  tour: { conversion: 0.02, avgOrder: 50_000, commission: 0.05 },
};
const TOUR = new Set(["klook", "kkday", "myrealtrip", "getyourguide", "trip-tour"]);

export interface DayRevenue {
  /** 애드센스 기대액 (실제 채워진 노출이 있으면 그것으로, 없으면 페이지뷰로 추정) */
  ads: number;
  adsFrom: "measured" | "estimated";
  /** 제휴 값이 붙은 업체 클릭만 (실제로 받을 수 있는 몫) */
  affiliate: number;
  /** 모든 숙소·투어 클릭에 제휴가 붙어 있었다면 */
  affiliatePotential: number;
  total: number;
  /** 순방문자 1명당 */
  perUser: number;
  /** 방문 1번당 */
  perSession: number;
}

export function dayRevenue(d: DayTraffic): DayRevenue {
  const f = d.f;
  const langs = Object.keys(AD_IMPRESSION_RPM);
  const measured = langs.reduce((s, l) => s + (f[`ad:${l}`] ?? 0), 0);
  // Plus 회원은 광고를 안 보므로 뺀다
  const ads = measured
    ? langs.reduce((s, l) => s + ((f[`ad:${l}`] ?? 0) / 1000) * AD_IMPRESSION_RPM[l], 0)
    : langs.reduce((s, l) => {
        const share = d.pv ? (f[`pv:${l}`] ?? 0) / d.pv : 0;
        const pv = Math.max(d.pv - (f["pv:plus"] ?? 0), 0) * share;
        return s + ((pv * ADS_PER_PAGE * FILL_RATE) / 1000) * AD_IMPRESSION_RPM[l];
      }, 0);
  const clicks = Object.entries(f).filter(([k]) => k.startsWith("aff:"));
  const value = (id: string, n: number) => {
    const a = AFFILIATE[TOUR.has(id) ? "tour" : "stay"];
    return n * a.conversion * a.avgOrder * a.commission;
  };
  const affiliate = clicks.reduce((s, [k, n]) => s + (isAffiliate(k.slice(4)) ? value(k.slice(4), n) : 0), 0);
  const affiliatePotential = clicks.reduce((s, [k, n]) => s + value(k.slice(4), n), 0);
  const total = ads + affiliate;
  return {
    ads,
    adsFrom: measured ? "measured" : "estimated",
    affiliate,
    affiliatePotential,
    total,
    perUser: d.uv ? total / d.uv : 0,
    perSession: d.sessions ? total / d.sessions : 0,
  };
}
