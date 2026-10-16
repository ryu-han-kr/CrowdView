"use client";

import { useI18n } from "@/i18n/client";

/** Plus 구독 버튼. 결제 연동 전에는 준비 중으로 보여준다 */
export function PlusCheckoutButton({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <button disabled className={`rounded-2xl bg-white py-3 text-sm font-bold text-indigo-700 ${className}`}>
      {t("결제 연동 준비 중")}
    </button>
  );
}
