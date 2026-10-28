// 사업자·서비스 정보 (푸터, 약관, 개인정보처리방침, 요금 페이지가 함께 쓴다).
// 사업자등록이 끝나면 아래 "등록 예정" 값만 바꾸면 모든 페이지에 반영된다.

export const BUSINESS = {
  serviceName: "CrowdView",
  /** 상호 */
  company: "한경수",
  /** 대표자 */
  ceo: "한경수",
  /** 사업자등록번호 (예: 123-45-67890) */
  bizNo: "528-25-02324",
  /** 통신판매업 신고번호 (예: 제2026-서울강남-0000호) */
  mailOrderNo: "제2026-서울강남-06020호" as string,
  address: "서울특별시 강남구 밤고개로26길 50, 607동 401호(율현동, 강남한신휴플러스6단지)",
  phone: "010-6705-5683",
  email: "hks.han666@gmail.com",
  /** 개인정보 보호책임자 */
  privacyOfficer: "한경수",
  url: "https://crowdview.app",
} as const;

/**
 * 판매 열림: 통신판매업 신고번호가 들어가면 자동으로 열린다 (10/22: 토스 라이브 키는 넣었지만 신고증이 아직 → 결제 버튼 '준비 중').
 * 결제 버튼(PlusCheckoutButton)과 결제 시작 API(/api/plus/pass·subscribe)가 함께 본다
 */
export const SALES_OPEN = BUSINESS.mailOrderNo !== "등록 예정";

/** 약관·개인정보처리방침·환불정책 시행일. 처음 시행하는 방침이라 게시일(10/22)로. 이후 바꿀 때는 7일 전(불리한 변경은 30일 전) 공지하고 새 날짜로 */
export const LEGAL_EFFECTIVE_DATE = "2026-10-22";

/** 개인정보처리방침만 따로 개정: 10/26 공지 → 7일 뒤 시행 (익명 이용 통계 한 줄 추가, 이용자에게 불리하지 않은 변경) */
export const PRIVACY_NOTICE_DATE = "2026-10-26";
export const PRIVACY_EFFECTIVE_DATE = "2026-11-02";

/**
 * 유료 단계 (경수님 10/28: Plus·Pro 두 단계, SK '지금 실제 인원' 횟수를 다르게).
 * SK 장소 혼잡도 Basic은 건당 33원(일 한도 100건) → 한 사람이 한 달 내내 다 써도 매출의 약 1/4을 넘지 않게 월 횟수로도 묶는다.
 * 누군가 10분 안에 본 곳은 SK를 다시 부르지 않으니 횟수에서 빼지 않는다 (lib/live-count)
 */
export type PlanId = "plus" | "pro";
export const PLANS = {
  plus: { id: "plus", name: "CrowdView Plus", priceKrw: 3900, periodMonths: 1, liveDaily: 3, liveMonthly: 30, alerts: 30 },
  pro: { id: "pro", name: "CrowdView Pro", priceKrw: 6900, periodMonths: 1, liveDaily: 5, liveMonthly: 60, alerts: 100 },
} as const;
export const planOf = (id: unknown): (typeof PLANS)[PlanId] => (id === "pro" ? PLANS.pro : PLANS.plus);

/** 기본 유료 단계 (예전 코드·문구가 쓰는 이름) */
export const PLUS = PLANS.plus;
