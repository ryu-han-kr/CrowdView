"use client";

import Link from "@/i18n/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { PlusState } from "@/lib/plus";
import { PLUS } from "@/lib/business";
import { cancelPlus, refundPlus } from "@/lib/plus-browser";
import { ConfirmSheet } from "./ConfirmSheet";

/** 마이페이지 계정 칸 안의 Plus 상태·해지·환불 */
export function PlusPanel() {
  const { t } = useI18n();
  const [plus, setPlus] = useState<PlusState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 해지·환불 전 확인 창
  const [asking, setAsking] = useState<null | "cancel" | "refund">(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setPlus(j.plus))
      .catch(() => {});
  }, []);

  const run = async (fn: () => Promise<{ plus: PlusState }>) => {
    setBusy(true);
    setError(null);
    try {
      setPlus((await fn()).plus);
      setAsking(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!plus) return null;
  const end = plus.periodEnd ? new Date(plus.periodEnd).toLocaleDateString() : "";
  return (
    <div className="mt-4 rounded-2xl bg-indigo-50 px-4 py-3 text-sm">
      {plus.active ? (
        <>
          <p className="font-bold text-indigo-800">
            CrowdView Plus · {plus.status === "canceled" ? t("해지됨 ({date}까지 이용)", { date: end }) : t("다음 결제일 {date}", { date: end })}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
            {plus.status === "active" && (
              <button disabled={busy} onClick={() => setAsking("cancel")} className="text-gray-600 underline">
                {t("정기결제 해지")}
              </button>
            )}
            {plus.refundable && (
              <button disabled={busy} onClick={() => setAsking("refund")} className="text-red-600 underline">
                {t("7일 이내 전액 환불")}
              </button>
            )}
          </div>
        </>
      ) : (
        <Link href="/pricing" className="font-bold text-indigo-700">
          {t("Plus 알아보기")} ›
        </Link>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {asking === "cancel" && (
        <ConfirmSheet
          title={t("정기결제를 해지할까요?")}
          lines={[
            t("{date}까지는 Plus를 계속 쓸 수 있어요", { date: end }),
            t("그 뒤로는 자동 결제되지 않아요"),
            t("다시 쓰고 싶으면 요금 안내에서 다시 시작하면 돼요"),
          ]}
          confirmLabel={t("해지하기")}
          danger
          busy={busy}
          onClose={() => setAsking(null)}
          onConfirm={() => run(cancelPlus)}
        />
      )}
      {asking === "refund" && (
        <ConfirmSheet
          title={t("전액 환불할까요?")}
          lines={[
            t("이번 달 이용료 {price}원을 전액 환불해요", { price: PLUS.priceKrw.toLocaleString() }),
            t("Plus가 바로 끝나요 (광고 제거·혼잡 알림 해제)"),
            t("카드사에 따라 환불이 보이기까지 3~7영업일 걸릴 수 있어요"),
            t("환불은 되돌릴 수 없어요"),
          ]}
          confirmLabel={t("환불하기")}
          danger
          busy={busy}
          onClose={() => setAsking(null)}
          onConfirm={() => run(refundPlus)}
        />
      )}
    </div>
  );
}
