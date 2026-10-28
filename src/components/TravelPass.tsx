"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSession } from "@/lib/auth-client";

/** Paddle 클라이언트 토큰 (live_… / test_…). 없으면 결제 버튼은 '준비 중' */
const TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
const PRICE_7D = process.env.NEXT_PUBLIC_PADDLE_PRICE_7D ?? "pri_01m608766sry3nhj5y6eck3q3b";
const PRICE_30D = process.env.NEXT_PUBLIC_PADDLE_PRICE_30D ?? "pri_01m60881fypvhg2pryp2rm2j8q";

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void };
      Initialize: (o: { token: string }) => void;
      Checkout: { open: (o: unknown) => void };
    };
  }
}

let loading: Promise<void> | undefined;
/** Paddle.js는 결제 버튼을 누를 때 처음 받는다 (모든 화면에 싣지 않게) */
function loadPaddle(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.onload = () => {
      if (TOKEN?.startsWith("test_")) window.Paddle?.Environment.set("sandbox");
      window.Paddle?.Initialize({ token: TOKEN! });
      resolve();
    };
    s.onerror = () => {
      loading = undefined;
      reject(new Error("Paddle"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * 외국인 여행 패스 (경수님 10/28: 해외는 월 구독 대신 한 번 결제하는 패스). 7일 $3.99 · 30일 $6.99, Pro 기능 전부.
 * 결제는 Paddle(카드·PayPal·Apple/Google Pay, 나라별 통화·세금), 완료되면 웹훅이 패스를 켠다 (api/paddle/webhook)
 */
export function TravelPass() {
  const { t, lp } = useI18n();
  const { data } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (priceId: string) => {
    if (!data?.user) {
      location.href = `${lp("/login")}?next=${encodeURIComponent(lp("/pricing"))}`;
      return;
    }
    setBusy(priceId);
    setError(null);
    try {
      await loadPaddle();
      window.Paddle?.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { userId: data.user.id },
        ...(data.user.email && !data.user.email.endsWith("@users.crowdview.app") && { customer: { email: data.user.email } }),
        settings: { displayMode: "overlay", successUrl: `${location.origin}${lp("/me")}?pass=1` },
      });
    } catch {
      setError(t("잠시 뒤 다시 시도해 주세요"));
    }
    setBusy(null);
  };

  const cards = [
    { id: PRICE_7D, days: 7, price: "$3.99", note: t("짧은 여행에 딱") },
    { id: PRICE_30D, days: 30, price: "$6.99", note: t("한 달 머무는 여행") },
  ];
  return (
    <section className="mt-6 overflow-hidden rounded-3xl bg-gray-950 p-5 text-white ring-1 ring-amber-300/60 md:p-6">
      <p className="w-fit bg-gradient-to-r from-amber-200 to-yellow-100 bg-clip-text text-sm font-bold text-transparent">CrowdView Travel Pass</p>
      <h2 className="mt-1 text-2xl font-extrabold">{t("여행하는 동안만, 한 번 결제")}</h2>
      <p className="mt-1 text-sm text-white/75">{t("자동으로 다시 결제되지 않아요. Pro 기능(지금 실제 인원 보기·광고 없이·알림)을 패스 기간 동안 써요.")}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={!TOKEN || busy !== null}
            onClick={() => buy(c.id)}
            className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-4 text-left ring-1 ring-white/15 transition hover:bg-white/15 disabled:opacity-70"
          >
            <span>
              <span className="block text-lg font-extrabold">{t("{n}일 패스", { n: c.days })}</span>
              <span className="block text-xs text-white/70">{c.note}</span>
            </span>
            <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-200 px-3.5 py-1.5 text-sm font-extrabold text-gray-900">
              {!TOKEN ? t("곧 열려요") : busy === c.id ? "…" : c.price}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-white/60">
        {t("결제는 Paddle이 판매자로 처리해요(카드·PayPal 등, 나라별 통화와 세금 포함). 결제 후 7일 안에 쓰지 않았다면 전액 환불돼요.")}
      </p>
      {error && <p className="mt-2 text-xs font-semibold text-rose-300">{error}</p>}
    </section>
  );
}
