"use client";

import Link from "@/i18n/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { PlusState } from "@/lib/plus";
import { PLUS, planOf } from "@/lib/business";
import { cancelPlus, redeemCode, refundPlus } from "@/lib/plus-browser";
import { ConfirmSheet } from "./ConfirmSheet";

/** 마이페이지 계정 칸 안의 Plus 상태·해지·환불 */
export function PlusPanel() {
  const { t } = useI18n();
  const [plus, setPlus] = useState<PlusState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 해지·환불 전 확인 창
  const [asking, setAsking] = useState<null | "cancel" | "refund">(null);
  // 이용 코드 입력 (경수님 10/28)
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);

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
            {planOf(plus.plan).name} ·{" "}
            {plus.status === "pass"
              ? t("{date}까지 이용", { date: end })
              : plus.status === "canceled"
                ? t("해지됨 ({date}까지 이용)", { date: end })
                : t("다음 결제일 {date}", { date: end })}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
            {plus.status === "active" && (
              <button disabled={busy} onClick={() => setAsking("cancel")} className="text-gray-600 underline">
                {t("정기결제 해지")}
              </button>
            )}
            {plus.status === "pass" && (
              <Link href="/pricing?extend=1" className="text-indigo-700 underline">
                {t("1개월 더 이어서 결제")}
              </Link>
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
      {/* 이용 코드: 결제 없이 Plus·Pro·Max 기간을 받는 코드 (이벤트·테스터·운영자) */}
      {codeOpen ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) run(() => redeemCode(code)).then(() => setDone(true));
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("이용 코드 입력")}
            aria-label={t("이용 코드 입력")}
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-indigo-500"
          />
          <button disabled={busy || !code.trim()} className="shrink-0 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-bold text-white disabled:opacity-60">
            {t("적용")}
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setCodeOpen(true)} className="mt-2 block text-xs font-semibold text-indigo-700 underline">
          {t("이용 코드가 있어요")}
        </button>
      )}
      {done && !error && <p className="mt-2 text-xs font-semibold text-emerald-700">{t("코드가 적용됐어요")}</p>}
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
