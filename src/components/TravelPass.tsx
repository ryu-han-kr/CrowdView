"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSession } from "@/lib/auth-client";
import { PLANS, type PlanId } from "@/lib/business";
import { PASSES } from "@/lib/passes";
import { isTwa } from "@/lib/play-billing-client";

/** Paddle 클라이언트 토큰 (live_… / test_…). 없으면 결제 버튼은 '준비 중' */
const TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

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

/** 단계별 카드 색: Plus 보라 · Pro 검정·금색 · Max 무지갯빛 (한국 요금 카드와 같은 색) */
const TIER: Record<PlanId, { card: string; name: string; chip: string; note: string }> = {
  plus: {
    card: "bg-gradient-to-br from-indigo-600 to-violet-600 ring-white/10",
    name: "text-white/85",
    chip: "bg-white text-indigo-700",
    note: "광고 없이 · 1년 혼잡 달력 · 코스 전체",
  },
  pro: {
    card: "bg-gray-900 ring-amber-300/60",
    name: "bg-gradient-to-r from-amber-200 to-yellow-100 bg-clip-text text-transparent",
    chip: "bg-gradient-to-r from-amber-300 to-yellow-200 text-gray-900",
    note: "Plus 기능 전부 + 알림 {n}개",
  },
  max: {
    card: "bg-gradient-to-br from-gray-950 via-violet-950 to-fuchsia-950 ring-fuchsia-300/60",
    name: "bg-gradient-to-r from-fuchsia-200 via-violet-200 to-cyan-200 bg-clip-text text-transparent",
    chip: "bg-gradient-to-r from-fuchsia-300 via-violet-200 to-cyan-200 text-gray-900",
    note: "Pro 기능 전부 + 알림 {n}개 · 문의 먼저",
  },
};

/**
 * 외국인 여행 패스 (경수님 10/28: 해외는 월 구독 대신 한 번 결제하는 패스, 저녁에 '등급 3개 + 한 번 결제 둘 다').
 * Plus·Pro·Max × 7일·30일 (lib/passes). 결제는 Paddle(카드·PayPal·Apple/Google Pay, 나라별 통화·세금),
 * 완료되면 웹훅이 고른 단계로 패스를 켠다 (api/paddle/webhook)
 */
export function TravelPass() {
  const { t, lp } = useI18n();
  const { data } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Play 스토어 앱 안에서는 다른 결제사(Paddle)를 보여 주지 않는다 (Play 정책, 경수님 10/30)
  const [app, setApp] = useState(false);
  useEffect(() => setApp(isTwa()), []);

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

  if (app) return null;
  return (
    <section className="mt-6 overflow-hidden rounded-3xl bg-gray-950 p-5 text-white ring-1 ring-white/10 md:p-6">
      <p className="w-fit bg-gradient-to-r from-amber-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-sm font-bold text-transparent">CrowdView Travel Pass</p>
      <h2 className="mt-1 text-2xl font-extrabold">{t("여행하는 동안만, 한 번 결제")}</h2>
      <p className="mt-1 text-sm text-white/75">{t("자동으로 다시 결제되지 않아요. 고른 등급의 기능을 패스 기간 동안 써요.")}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {(["plus", "pro", "max"] as const).map((plan) => {
          const P = PLANS[plan];
          const s = TIER[plan];
          return (
            <div key={plan} className={`relative flex flex-col rounded-2xl p-4 ring-1 ${s.card}`}>
              {plan === "max" && (
                <span className="absolute top-3 right-3 rounded-full bg-gradient-to-r from-fuchsia-300 via-violet-200 to-cyan-200 px-2 py-0.5 text-[10px] font-extrabold text-gray-900">
                  {t("가장 넉넉하게")}
                </span>
              )}
              <p className={`w-fit text-sm font-bold ${s.name}`}>{P.name.replace("CrowdView ", "")}</p>
              <p className="mt-1 text-xs text-white/80">{t("지금 실제 인원 보기 하루 {d}회 (월 {m}회)", { d: P.liveDaily, m: P.liveMonthly })}</p>
              <p className="mt-0.5 flex-1 text-xs text-white/65">{t(s.note, { n: P.alerts })}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {PASSES.filter((x) => x.plan === plan).map((x) => (
                  <button
                    key={x.priceId}
                    type="button"
                    disabled={!TOKEN || busy !== null}
                    onClick={() => buy(x.priceId)}
                    className="flex flex-col items-center rounded-xl bg-white/10 px-2 py-2.5 ring-1 ring-white/15 transition hover:bg-white/20 disabled:opacity-70"
                  >
                    <span className="text-xs font-semibold text-white/80">{t("{n}일 패스", { n: x.days })}</span>
                    <span className={`mt-1 rounded-full px-2.5 py-0.5 text-sm font-extrabold ${s.chip}`}>
                      {!TOKEN ? t("곧 열려요") : busy === x.priceId ? "…" : x.usd}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-white/60">
        {t("결제는 Paddle이 판매자로 처리해요(카드·PayPal 등, 나라별 통화와 세금 포함). 결제 후 7일 안에 쓰지 않았다면 전액 환불돼요.")}
      </p>
      {error && <p className="mt-2 text-xs font-semibold text-rose-300">{error}</p>}
    </section>
  );
}
