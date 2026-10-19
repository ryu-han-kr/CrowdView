"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSession } from "@/lib/auth-client";
import { checkoutEnabled, startCardRegistration } from "@/lib/plus-browser";
import { PLUS } from "@/lib/business";
import { usePlus } from "@/lib/plus-client";
import { ConfirmSheet } from "./ConfirmSheet";

/** Plus 구독 버튼: 로그인 → 토스페이먼츠 카드 등록 → (돌아와서 /plus/complete) 첫 달 결제 */
export function PlusCheckoutButton({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  if (!checkoutEnabled)
    return (
      <button disabled className={`rounded-2xl bg-white py-3 text-sm font-bold text-indigo-700 ${className}`}>
        {t("결제 연동 준비 중")}
      </button>
    );
  return <Checkout className={className} />;
}

function Checkout({ className }: { className: string }) {
  const { t, lp } = useI18n();
  const { data, isPending } = useSession();
  const plus = usePlus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 결제 전 확인 창 (금액·자동결제·해지·환불 안내 + 동의 체크)
  const [asking, setAsking] = useState(false);
  const cls = `rounded-2xl bg-white py-3 text-sm font-bold text-indigo-700 ${className}`;

  if (plus)
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

  return (
    <div>
      <button disabled={busy || isPending} onClick={() => data?.user && setAsking(true)} className={cls}>
        {busy ? t("결제 진행 중…") : t("Plus 시작하기")}
      </button>
      {asking && (
        <ConfirmSheet
          title={t("{name} 결제", { name: PLUS.name })}
          lines={[
            t("월 {price}원 (부가세 포함)", { price: PLUS.priceKrw.toLocaleString() }),
            t("오늘 첫 달이 결제되고, 매달 오늘과 같은 날짜에 같은 카드로 자동 결제돼요"),
            t("자동 결제 7일 전에 미리 알려 드려요"),
            t("언제든 마이페이지에서 해지할 수 있고, 해지해도 낸 기간까지는 이용해요"),
            t("결제 후 7일 안에 Plus 기능을 쓰지 않았으면 전액 환불돼요"),
          ]}
          agree={t("위 내용을 확인했고, 매달 자동 결제에 동의해요")}
          confirmLabel={t("카드 등록하고 결제하기")}
          busy={busy}
          onClose={() => setAsking(false)}
          onConfirm={async () => {
            if (!data?.user) return;
            setBusy(true);
            setError(null);
            try {
              // 등록이 끝나면 토스가 /plus/complete로 보내고, 거기서 첫 달을 결제한다
              await startCardRegistration(data.user, `${location.origin}${lp("/plus/complete")}`);
            } catch (e) {
              const code = (e as { code?: string })?.code;
              if (code !== "USER_CANCEL") setError(e instanceof Error ? e.message : String(e));
              setBusy(false);
              setAsking(false);
            }
          }}
        />
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-100">{error}</p>}
    </div>
  );
}
