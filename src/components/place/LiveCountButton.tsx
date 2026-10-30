"use client";

import { useEffect, useState } from "react";
import Link from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import { levelOf, inkOf } from "@/lib/levels";
import { usePlus } from "@/lib/plus-client";
import { useSession } from "@/lib/auth-client";
import type { PlanId } from "@/lib/business";
import { LIVE_PAID_ONLY } from "@/lib/live-flags";

/**
 * 통신사별 참고값: 휴대폰 회선 점유율(과기정통부 2026년 2월). SK 추정 인원은 이미 전체 인구로 환산한 값이라
 * 장소별 실제 통신사 비율이 아니라 '약 N명을 점유율로 나눈 값'이다 (화면에도 그렇게 적는다)
 */
const CARRIERS = [
  { name: "SKT", share: 0.39, color: "#ef4444" },
  { name: "KT", share: 0.233, color: "#111827" },
  { name: "LG U+", share: 0.1958, color: "#e11d8f" },
  { name: "알뜰폰", share: 0.1809, color: "#9ca3af" },
];

interface Res {
  data?: { level: number; score: number; time: string; poiName: string; people?: number };
  shared?: boolean;
  left?: { day: number; month: number };
  plan?: PlanId;
  unlimited?: boolean;
  error?: string;
}

/**
 * 유료 '지금 실제 인원 보기' (SK텔레콤 장소 혼잡도, 경수님 10/28). 누를 때만 불러온다.
 * 비회원·무료는 잠긴 버튼 → 요금 안내. 회원은 결과 카드 + 남은 횟수 (다른 회원이 10분 안에 본 곳은 횟수 그대로)
 * 지금은 실제로 결제한 회원·운영자만 (lib/live-flags): 쿠키 대신 서버에 물어 열고, 아니면 잠긴 버튼
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
    if ((plusCookie && !LIVE_PAID_ONLY) || !data?.user) return;
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
  const plus = (plusCookie && !LIVE_PAID_ONLY) || allowed;

  if (!plus)
    return (
      <Link
        href="/pricing"
        className="mt-3 flex items-center gap-3 rounded-2xl bg-gray-950 px-4 py-3 text-white transition active:scale-[0.99]"
      >
        <span aria-hidden className="text-lg">🔒</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{t("지금 실제 인원 보기")}</span>
          <span className="block text-xs text-white/70">{t("SK텔레콤 실측 · 유료 회원 전용")}</span>
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
          {res.data.people !== undefined ? (
            <>
              <p className="mt-0.5 flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums" style={{ color: inkOf(lv.color) }}>
                  {t("약 {n}명", { n: res.data.people.toLocaleString() })}
                </span>
                <span className="text-sm font-bold" style={{ color: inkOf(lv.color) }}>
                  {t(lv.label)}
                </span>
              </p>
              <p className="text-xs text-gray-600">{t(lv.desc)}</p>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full" aria-hidden>
                {CARRIERS.map((c) => (
                  <span key={c.name} style={{ width: `${c.share * 100}%`, background: c.color }} />
                ))}
              </div>
              <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-gray-700">
                {CARRIERS.map((c) => (
                  <li key={c.name} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                    {t(c.name)} {Math.round(c.share * 1000) / 10}% · {t("약 {n}명", { n: Math.round(res.data!.people! * c.share).toLocaleString() })}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[10px] leading-snug text-gray-600">
                {t("SK 추정 인원에 장소 넓이(지도 경계)를 곱한 값이에요. 통신사별 인원은 휴대폰 회선 점유율(2026년 2월)로 나눈 참고값이에요.")}
              </p>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-2xl font-black" style={{ color: inkOf(lv.color) }}>
                {t(lv.label)}
              </p>
              <p className="text-xs text-gray-600">{t(lv.desc)}</p>
            </>
          )}
          {res.shared && <p className="mt-1 text-[11px] font-semibold text-emerald-700">{t("방금 다른 회원이 본 결과라 횟수가 줄지 않았어요")}</p>}
        </div>
      )}
      {res?.error && !res.data && <p className="mt-2 text-xs font-semibold text-rose-600">{t(res.error)}</p>}
    </div>
  );
}
