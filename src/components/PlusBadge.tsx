"use client";

// 상단 메뉴의 Plus 표시 (경수님 QA #2 10/27: 유료가 안 보인다). Plus 회원은 배지, 아니면 요금 안내로 가는 작은 버튼
import Link from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import { usePlus } from "@/lib/plus-client";
import { PLUS } from "@/lib/business";

export function PlusBadge({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const plus = usePlus();
  return plus ? (
    <Link href="/me" className={`rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-extrabold text-white ${className}`} title={t("Plus 이용 중")}>
      Plus ✓
    </Link>
  ) : (
    <Link
      href="/pricing"
      className={`rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-px ${className}`}
    >
      Plus · {t("1개월 {n}원", { n: PLUS.priceKrw.toLocaleString() })}
    </Link>
  );
}
