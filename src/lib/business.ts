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

/** 유료 플랜 */
export const PLUS = {
  name: "CrowdView Plus",
  priceKrw: 3900,
  /** 결제 주기 (개월) */
  periodMonths: 1,
} as const;
