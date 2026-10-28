"use client";

import { useEffect, useState } from "react";
import Link from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import { levelOf, inkOf } from "@/lib/levels";
import { usePlus } from "@/lib/plus-client";
import { useSession } from "@/lib/auth-client";

interface Res {
  data?: { level: number; score: number; time: string; poiName: string };
  shared?: boolean;
  left?: { day: number; month: number };
  plan?: "plus" | "pro";
  error?: string;
}

/**
 * 유료 '지금 실제 인원 보기' (SK텔레콤 장소 혼잡도, 경수님 10/28). 누를 때만 불러온다.
 * 비회원·무료는 잠긴 버튼 → 요금 안내. 회원은 결과 카드 + 남은 횟수 (다른 회원이 10분 안에 본 곳은 횟수 그대로)
 */
export function LiveCountButton({ placeId }: { placeId: string }) {
  const { t } = useI18n();
  const plusCookie = usePlus();
  const { data } = useSession();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  // Plus 표시 쿠키가 없어도 로그인했으면 서버에 한 번 물어본다 (운영자 시험·다른 기기에서 결제한 회원)
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (plusCookie || !data?.user) return;
    fetch(`/api/plus/live/${placeId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Res | null) => {
        if (j?.left) {
          setAllowed(true);
          setRes({ left: j.left, plan: j.plan });
        }
      })
      .catch(() => {});
  }, [plusCookie, data?.user, placeId]);
  const plus = plusCookie || allowed;

  if (!plus)
    return (
      <Link
        href="/pricing"
        className="mt-3 flex items-center gap-3 rounded-2xl bg-gray-950 px-4 py-3 text-white transition active:scale-[0.99]"
      >
        <span aria-hidden className="text-lg">🔒</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{t("지금 실제 인원 보기")}</span>
          <span className="block text-xs text-white/70">{t("SK텔레콤 실측 · Plus·Pro 회원 전용")}</span>
        </span>
        <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-200 px-2.5 py-1 text-xs font-extrabold text-gray-900">{t("열어 보기")}</span>
      </Link>
    );

  const load = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/plus/live/${placeId}`, { method: "POST" });
      setRes((await r.json().catch(() => ({ error: t("잠시 뒤 다시 시도해 주세요") }))) as Res);
    } catch {
      setRes({ error: t("잠시 뒤 다시 시도해 주세요") });
    }
    setBusy(false);
  };

  const lv = res?.data ? levelOf(res.data.score) : undefined;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={load}
        disabled={busy}
        className="flex w-full items-center gap-3 rounded-2xl bg-gray-950 px-4 py-3 text-left text-white transition active:scale-[0.99] disabled:opacity-70"
      >
        <span aria-hidden className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-300" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{busy ? t("불러오는 중…") : t("지금 실제 인원 보기")}</span>
          <span className="block text-xs text-white/70">
            {res?.left ? t("오늘 {d}회 · 이번 달 {m}회 남음", { d: res.left.day, m: res.left.month }) : t("SK텔레콤 실측 · 누를 때 한 번 불러와요")}
          </span>
        </span>
        <span className="text-amber-200">›</span>
      </button>
      {res?.data && lv && (
        <div className="mt-2 animate-[fade-in_0.2s_ease-out] rounded-2xl px-4 py-3" style={{ background: `${lv.color}1f` }} role="status">
          <p className="text-xs font-semibold text-gray-600">{t("SK텔레콤 실측 · {time} 기준", { time: res.data.time.slice(11) || res.data.time })}</p>
          <p className="mt-0.5 text-2xl font-black" style={{ color: inkOf(lv.color) }}>
            {t(lv.label)}
          </p>
          <p className="text-xs text-gray-600">{t(lv.desc)}</p>
          {res.shared && <p className="mt-1 text-[11px] font-semibold text-emerald-700">{t("방금 다른 회원이 본 결과라 횟수가 줄지 않았어요")}</p>}
        </div>
      )}
      {res?.error && !res.data && <p className="mt-2 text-xs font-semibold text-rose-600">{t(res.error)}</p>}
    </div>
  );
}
