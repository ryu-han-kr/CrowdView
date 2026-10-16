// 사업자·서비스 정보 (푸터, 약관, 개인정보처리방침, 요금 페이지가 함께 쓴다).
// 사업자등록이 끝나면 아래 "등록 예정" 값만 바꾸면 모든 페이지에 반영된다.

export const BUSINESS = {
  serviceName: "CrowdView",
  /** 상호 */
  company: "등록 예정",
  /** 대표자 */
  ceo: "등록 예정",
  /** 사업자등록번호 (예: 123-45-67890) */
  bizNo: "등록 예정",
  /** 통신판매업 신고번호 (예: 제2026-서울강남-0000호) */
  mailOrderNo: "등록 예정",
  address: "등록 예정",
  phone: "등록 예정",
  email: "등록 예정",
  /** 개인정보 보호책임자 */
  privacyOfficer: "등록 예정",
  url: "https://crowdview.app",
} as const;

/** 약관·개인정보처리방침·환불정책 시행일 (출시일에 맞춰 바꾼다) */
export const LEGAL_EFFECTIVE_DATE = "2026-11-01";

/** 유료 플랜 */
export const PLUS = {
  name: "CrowdView Plus",
  priceKrw: 3900,
  /** 결제 주기 (개월) */
  periodMonths: 1,
} as const;
