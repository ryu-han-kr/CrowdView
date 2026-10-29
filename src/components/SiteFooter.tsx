import Link from "@/i18n/link";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { BUSINESS } from "@/lib/business";

/** 사업자 정보와 약관 링크 (전자상거래법 표시 의무, 결제대행사 심사에서 확인하는 항목) */
export function SiteFooter({ lang, className = "" }: { lang: Lang; className?: string }) {
  const t = getT(lang);
  const B = BUSINESS;
  return (
    <footer className={`border-t border-gray-100 pt-6 pb-8 text-xs leading-relaxed text-gray-500 ${className}`}>
      <nav className="flex flex-wrap gap-x-4 gap-y-1 font-semibold text-gray-700">
        <Link href="/about">{t("서비스 소개")}</Link>
        <Link href="/contact">{t("문의하기")}</Link>
        <Link href="/pricing">{t("요금 안내")}</Link>
        <Link href="/terms">{t("이용약관")}</Link>
        <Link href="/privacy" className="text-gray-900">
          {t("개인정보처리방침")}
        </Link>
        <Link href="/refund">{t("환불정책")}</Link>
        <Link href="/methodology">{t("데이터 출처·계산 방식")}</Link>
        <Link href="/accuracy">{t("예측 정확도")}</Link>
        <Link href="/crowd">{t("지금 붐비나요?")}</Link>
        <Link href="/history">{t("지난 혼잡 기록")}</Link>
      </nav>
      <p className="mt-3">
        {B.serviceName} · {t("상호")} <span lang="ko">{B.company}</span> · {t("대표")} <span lang="ko">{B.ceo}</span> · {t("사업자등록번호")} {B.bizNo}
      </p>
      <p>
        {t("통신판매업 신고")} {t(B.mailOrderNo)} · {t("주소")} <span lang="ko">{B.address}</span>
      </p>
      <p>
        {t("고객센터")} {t(B.phone)} · {t(B.email)}
      </p>
      <p className="mt-2 text-gray-500">{t("혼잡도 정보는 공공데이터와 예측 모델로 만든 참고 정보로, 실제와 다를 수 있어요.")}</p>
      <p className="mt-1 text-gray-500">© 2026 {B.serviceName}</p>
    </footer>
  );
}
