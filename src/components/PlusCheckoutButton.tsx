"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSession } from "@/lib/auth-client";
import { checkoutEnabled, startCardRegistration } from "@/lib/plus-browser";
import { usePlus } from "@/lib/plus-client";

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
      <button
        disabled={busy || isPending}
        onClick={async () => {
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
          }
        }}
        className={cls}
      >
        {busy ? t("결제 진행 중…") : t("Plus 시작하기")}
      </button>
      {error && <p className="mt-2 text-xs font-semibold text-red-100">{error}</p>}
    </div>
  );
}
