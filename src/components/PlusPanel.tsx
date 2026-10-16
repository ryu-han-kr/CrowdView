"use client";

import Link from "@/i18n/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { PlusState } from "@/lib/plus";
import { cancelPlus, refundPlus } from "@/lib/plus-browser";

/** 마이페이지 계정 칸 안의 Plus 상태·해지·환불 */
export function PlusPanel() {
  const { t } = useI18n();
  const [plus, setPlus] = useState<PlusState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            CrowdView Plus ·{" "}
            {plus.status === "canceled" ? t("해지됨 ({date}까지 이용)", { date: end }) : t("다음 결제일 {date}", { date: end })}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
            {plus.status === "active" && (
              <button disabled={busy} onClick={() => run(cancelPlus)} className="text-gray-600 underline">
                {t("정기결제 해지")}
              </button>
            )}
            {plus.refundable && (
              <button disabled={busy} onClick={() => run(refundPlus)} className="text-red-600 underline">
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
    </div>
  );
}
