"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSession } from "@/lib/auth-client";
import { checkoutEnabled, startCardRegistration, startPassPayment } from "@/lib/plus-browser";
import { PLUS, SALES_OPEN } from "@/lib/business";
import { usePlus } from "@/lib/plus-client";
import { ConfirmSheet } from "./ConfirmSheet";

/**
 * 매달 자동결제(빌링)는 토스 자동결제 계약이 끝나야 실제로 결제된다. 계약 전 운영에서는 NEXT_PUBLIC_PLUS_BILLING=off 로
 * 자동결제 버튼을 숨기고 1개월 이용권만 판다
 */
const billingEnabled = process.env.NEXT_PUBLIC_PLUS_BILLING !== "off";

/**
 * Plus 시작 버튼 두 가지: 1개월 이용권(한 번 결제, 자동 갱신 없음) · 매달 자동결제.
 * 로그인 → 토스 결제창(이용권) 또는 카드 등록창(자동결제) → /plus/complete 에서 서버가 승인·첫 달 결제
 */
export function PlusCheckoutButton({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  if (!checkoutEnabled)
    return (
      <button disabled className={`rounded-2xl bg-white py-3 text-sm font-bold text-indigo-700 ${className}`}>
        {t("결제 연동 준비 중")}
      </button>
    );
  // 통신판매업 신고번호가 나오기 전에는 팔지 않는다 (lib/business SALES_OPEN)
  if (!SALES_OPEN)
    return (
      <div className={className}>
        <button disabled className="w-full rounded-2xl bg-white/90 py-3 text-sm font-bold text-indigo-700">
          {t("결제 준비 중")}
        </button>
        <p className="mt-2 text-center text-xs font-semibold text-white/90">{t("판매 준비를 마치는 대로 곧 열려요")}</p>
      </div>
    );
  return <Checkout className={className} />;
}

function Checkout({ className }: { className: string }) {
  const { t, lp } = useI18n();
  const { data, isPending } = useSession();
  const plus = usePlus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 결제 전 확인 창 (금액·갱신 여부·환불 안내 + 동의 체크)
  const [asking, setAsking] = useState<null | "pass" | "billing">(null);
  const cls = `rounded-2xl bg-white py-3 text-sm font-bold text-indigo-700 ${className}`;
  const price = PLUS.priceKrw.toLocaleString();
  // 이용권으로 이용 중인 회원이 마이페이지 '1개월 더 이어서 결제'로 오면(?extend=1) 이용권 버튼을 보여 준다 (남은 기간 뒤로 이어 붙음)
  const [extend, setExtend] = useState(false);
  useEffect(() => setExtend(new URLSearchParams(location.search).get("extend") === "1"), []);

  if (plus && !extend)
    return (
      <a href={lp("/me")} className={`block text-center ${cls}`}>
        {t("Plus 이용 중 · 관리하기")}
      </a>
    );
  if (!isPending && !data?.user)
    return (
      <a href={`${lp("/login")}?next=${encodeURIComponent(lp("/pricing"))}`} className={`block text-center ${cls}`}>
        {t("로그인하고 시작하기")}
      </a>
    );

  const go = async (kind: "pass" | "billing") => {
    if (!data?.user) return;
    setBusy(true);
    setError(null);
    try {
      // 결제가 끝나면 토스가 /plus/complete로 보내고, 거기서 서버가 승인(이용권)하거나 첫 달을 결제(자동결제)한다
      const url = `${location.origin}${lp("/plus/complete")}`;
      if (kind === "pass") await startPassPayment(data.user, url);
      else await startCardRegistration(data.user, url);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "USER_CANCEL") setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setAsking(null);
    }
  };

  return (
    <div>
      <button disabled={busy || isPending} onClick={() => data?.user && setAsking("pass")} className={cls}>
        {busy && asking === "pass" ? t("결제 진행 중…") : t("1개월 이용권 결제 ({price}원)", { price })}
      </button>
      {billingEnabled && !plus && (
        <button
          disabled={busy || isPending}
          onClick={() => data?.user && setAsking("billing")}
          className={`mt-2 rounded-2xl border border-white/60 py-2.5 text-sm font-semibold text-white ${className}`}
        >
          {busy && asking === "billing" ? t("결제 진행 중…") : t("매달 자동결제로 시작")}
        </button>
      )}
      {asking === "pass" && (
        <ConfirmSheet
          title={t("{name} 1개월 이용권", { name: PLUS.name })}
          lines={[
            t("{price}원 (부가세 포함), 한 번만 결제돼요", { price }),
            t("이용 기간: 결제한 날부터 1개월"),
            t("자동으로 다시 결제되지 않아요. 끝날 때 마이페이지에서 1개월 더 이어서 결제할 수 있어요"),
            t("결제 후 7일 안에 Plus 기능을 쓰지 않았으면 전액 환불돼요"),
          ]}
          agree={t("위 내용을 확인했고, 결제에 동의해요")}
          confirmLabel={t("결제하기")}
          busy={busy}
          onClose={() => setAsking(null)}
          onConfirm={() => go("pass")}
        />
      )}
      {asking === "billing" && (
        <ConfirmSheet
          title={t("{name} 결제", { name: PLUS.name })}
          lines={[
            t("월 {price}원 (부가세 포함)", { price }),
            t("오늘 첫 달이 결제되고, 매달 오늘과 같은 날짜에 같은 카드로 자동 결제돼요"),
            t("자동 결제 7일 전에 미리 알려 드려요"),
            t("언제든 마이페이지에서 해지할 수 있고, 해지해도 낸 기간까지는 이용해요"),
            t("결제 후 7일 안에 Plus 기능을 쓰지 않았으면 전액 환불돼요"),
          ]}
          agree={t("위 내용을 확인했고, 매달 자동 결제에 동의해요")}
          confirmLabel={t("카드 등록하고 결제하기")}
          busy={busy}
          onClose={() => setAsking(null)}
          onConfirm={() => go("billing")}
        />
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-100">{error}</p>}
    </div>
  );
}
