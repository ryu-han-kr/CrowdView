"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSession } from "@/lib/auth-client";
import { checkoutEnabled, startCardRegistration, startPassPayment } from "@/lib/plus-browser";
import { planOf, SALES_OPEN, type PlanId } from "@/lib/business";
import { usePlus } from "@/lib/plus-client";
import { ConfirmSheet } from "./ConfirmSheet";

/**
 * 매달 자동결제(빌링)는 토스 자동결제 계약이 끝나야 실제로 결제된다. 계약 전 운영에서는 NEXT_PUBLIC_PLUS_BILLING=off 로
 * 자동결제 버튼을 숨기고 1개월 이용권만 판다
 */
const billingEnabled = process.env.NEXT_PUBLIC_PLUS_BILLING !== "off";

/**
 * 유료 시작 버튼: 매달 자동결제(주 버튼) · 1개월 이용권(한 번 결제). plan으로 Plus·Pro를 고른다.
 * 로그인 → 토스 카드 등록창(자동결제) 또는 결제창(이용권) → /plus/complete 에서 서버가 첫 달 결제·승인.
 * 자동결제 계약 전(NEXT_PUBLIC_PLUS_BILLING=off)에도 자동결제 안내는 보이고 버튼만 '곧 열려요'로 (토스 자동결제 심사 화면, 경수님 10/28)
 */
export function PlusCheckoutButton({ className = "", plan = "plus", tone = "light" }: { className?: string; plan?: PlanId; tone?: "light" | "gold" }) {
  const { t } = useI18n();
  const solid = tone === "gold" ? "bg-gradient-to-r from-amber-300 to-yellow-200 text-gray-900" : "bg-white text-indigo-700";
  if (!checkoutEnabled)
    return (
      <button disabled className={`rounded-2xl py-3 text-sm font-bold ${solid} ${className}`}>
        {t("결제 연동 준비 중")}
      </button>
    );
  // 통신판매업 신고번호가 나오기 전에는 팔지 않는다 (lib/business SALES_OPEN)
  if (!SALES_OPEN)
    return (
      <div className={className}>
        <button disabled className={`w-full rounded-2xl py-3 text-sm font-bold opacity-90 ${solid}`}>
          {t("결제 준비 중")}
        </button>
        <p className="mt-2 text-center text-xs font-semibold text-white/90">{t("판매 준비를 마치는 대로 곧 열려요")}</p>
      </div>
    );
  return <Checkout className={className} plan={plan} solid={solid} />;
}

function Checkout({ className, plan, solid }: { className: string; plan: PlanId; solid: string }) {
  const { t, lp } = useI18n();
  const { data, isPending } = useSession();
  const plus = usePlus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 결제 전 확인 창 (금액·갱신 여부·환불 안내 + 동의 체크)
  const [asking, setAsking] = useState<null | "pass" | "billing">(null);
  const P = planOf(plan);
  const cls = `rounded-2xl py-3 text-sm font-bold ${solid} ${className}`;
  const price = P.priceKrw.toLocaleString();
  // 이용권으로 이용 중인 회원이 마이페이지 '1개월 더 이어서 결제'로 오면(?extend=1) 이용권 버튼을 보여 준다 (남은 기간 뒤로 이어 붙음)
  const [extend, setExtend] = useState(false);
  useEffect(() => setExtend(new URLSearchParams(location.search).get("extend") === "1"), []);

  if (plus && !extend)
    return (
      <a href={lp("/me")} className={`block text-center ${cls}`}>
        {t("이용 중 · 관리하기")}
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
      // 결제가 끝나면 토스가 /plus/complete로 보내고, 거기서 서버가 승인(이용권)하거나 첫 달을 결제(자동결제)한다. 단계는 주소에 실어 보낸다
      const url = `${location.origin}${lp("/plus/complete")}?plan=${plan}`;
      if (kind === "pass") await startPassPayment(data.user, url, plan);
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
      {/* 주 버튼: 매달 자동결제. 계약 전이면 안내만 보이고 눌리지 않는다 */}
      <button
        disabled={!billingEnabled || busy || isPending || !!plus}
        onClick={() => data?.user && setAsking("billing")}
        className={`${cls} disabled:cursor-not-allowed ${billingEnabled ? "" : "opacity-80"}`}
      >
        {!billingEnabled
          ? t("매달 자동결제 · 곧 열려요")
          : busy && asking === "billing"
            ? t("결제 진행 중…")
            : t("매달 자동결제로 시작 (월 {price}원)", { price })}
      </button>
      <button
        disabled={busy || isPending}
        onClick={() => data?.user && setAsking("pass")}
        className={`mt-2 rounded-2xl border border-white/50 py-2.5 text-sm font-semibold text-white ${className}`}
      >
        {busy && asking === "pass" ? t("결제 진행 중…") : t("1개월 이용권으로 먼저 써 보기 ({price}원)", { price })}
      </button>
      {asking === "pass" && (
        <ConfirmSheet
          title={t("{name} 1개월 이용권", { name: P.name })}
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
          title={t("{name} 결제", { name: P.name })}
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
