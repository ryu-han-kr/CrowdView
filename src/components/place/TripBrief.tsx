"use client";

import { useEffect, useState } from "react";
import { Luggage } from "lucide-react";
import Link from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import { usePlus } from "@/lib/plus-client";
import { useSession } from "@/lib/auth-client";
import type { TripBrief as Brief } from "@/lib/trip-brief";

const NEED: Record<Brief["ticket"]["need"], { label: string; cls: string }> = {
  free: { label: "무료 입장", cls: "bg-emerald-100 text-emerald-800" },
  paid: { label: "입장권 필요", cls: "bg-amber-100 text-amber-900" },
  partly: { label: "입장 무료 · 일부 유료", cls: "bg-sky-100 text-sky-900" },
  unknown: { label: "현장 확인", cls: "bg-gray-100 text-gray-700" },
};
const MODE: Record<Brief["transport"][number]["mode"], string> = { subway: "🚇", bus: "🚌", car: "🚗", taxi: "🚕", walk: "🚶", train: "🚆", other: "🧭" };

/**
 * 유료 'AI 여행 요약' (경수님 10/28): 입장권(필요한지·얼마·어디서) · 가는 길 · 둘러보는 시간 · 꼭 볼 것 · 팁 · 추천 동선 + 우리 혼잡 예측의 한산한 때.
 * 누를 때만 불러온다 (처음 여는 장소는 웹 검색으로 만들어 1~2분). 무료·비회원은 잠긴 카드 → 요금 안내
 */
export function TripBrief({ placeId, calmLine }: { placeId: string; calmLine: string }) {
  const { t, lang } = useI18n();
  const plusCookie = usePlus();
  const { data } = useSession();
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 쿠키 없이 로그인한 회원(운영자·다른 기기 결제)은 '지금 실제 인원'과 같은 서버 확인으로 연다
  useEffect(() => {
    if (plusCookie || !data?.user) return;
    fetch(`/api/plus/live/${placeId}`, { cache: "no-store" })
      .then((r) => setAllowed(r.ok))
      .catch(() => {});
  }, [plusCookie, data?.user, placeId]);

  if (!plusCookie && !allowed)
    return (
      <Link href="/pricing" className="mt-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white transition active:scale-[0.99]">
<Luggage aria-hidden className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{t("AI 여행 요약")}</span>
          <span className="block text-xs text-white/80">{t("입장권·요금·가는 길·볼거리·추천 동선 한눈에 · 유료 회원 전용")}</span>
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-indigo-700">{t("열어 보기")}</span>
      </Link>
    );

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/plus/brief/${placeId}?lang=${lang}`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { brief?: Brief; error?: string };
      if (j.brief) setBrief(j.brief);
      else setError(j.error ?? "잠시 뒤 다시 시도해 주세요");
    } catch {
      setError("잠시 뒤 다시 시도해 주세요");
    }
    setBusy(false);
  };

  if (!brief)
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-left text-white transition active:scale-[0.99] disabled:opacity-80"
        >
<Luggage aria-hidden className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">{busy ? t("최신 요금·교통을 확인하는 중…") : t("AI 여행 요약 보기")}</span>
            <span className="block text-xs text-white/80">{busy ? t("처음 여는 곳은 1~2분쯤 걸려요") : t("입장권·요금·가는 길·볼거리·추천 동선")}</span>
          </span>
          <span className="text-white/80">›</span>
        </button>
        {error && <p className="mt-2 text-xs font-semibold text-rose-600">{t(error)}</p>}
      </div>
    );

  const need = NEED[brief.ticket.need];
  return (
    <section className="mt-3 animate-[fade-in_0.2s_ease-out] rounded-3xl border border-indigo-100 bg-gradient-to-b from-indigo-50/80 to-white p-4" aria-label={t("AI 여행 요약")}>
      <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
        <Luggage aria-hidden className="h-4 w-4" /> {t("AI 여행 요약")}
      </p>
      <p className="mt-1 text-[15px] leading-snug font-bold text-gray-900">{brief.summary}</p>

      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="flex items-center gap-2 text-xs font-bold text-gray-500">
            🎟️ {t("입장권")}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${need.cls}`}>{t(need.label)}</span>
          </dt>
          {brief.ticket.price && <dd className="mt-1 font-semibold text-gray-900">{brief.ticket.price}</dd>}
          {brief.ticket.where && <dd className="mt-0.5 text-[13px] text-gray-600">{brief.ticket.where}</dd>}
        </div>
        {brief.transport.length > 0 && (
          <div>
            <dt className="text-xs font-bold text-gray-500">🗺️ {t("가는 길")}</dt>
            {brief.transport.map((r, i) => (
              <dd key={i} className="mt-1 flex gap-2 text-[13px] text-gray-800">
                <span aria-hidden>{MODE[r.mode]}</span>
                <span>{r.how}</span>
              </dd>
            ))}
          </div>
        )}
        {brief.stay && (
          <div>
            <dt className="text-xs font-bold text-gray-500">⏱️ {t("둘러보는 시간")}</dt>
            <dd className="mt-1 font-semibold text-gray-900">{brief.stay}</dd>
          </div>
        )}
        {brief.highlights.length > 0 && (
          <div>
            <dt className="text-xs font-bold text-gray-500">⭐ {t("꼭 볼 것")}</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {brief.highlights.map((h) => (
                <span key={h} className="rounded-full bg-white px-2.5 py-1 text-[13px] font-semibold text-gray-800 ring-1 ring-gray-200">
                  {h}
                </span>
              ))}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-bold text-gray-500">📅 {t("한산한 때 (CrowdView 예측)")}</dt>
          <dd className="mt-1 font-semibold text-gray-900">{calmLine}</dd>
        </div>
        {brief.plan && (
          <div>
            <dt className="text-xs font-bold text-gray-500">🧭 {t("추천 동선")}</dt>
            <dd className="mt-1 text-[13px] text-gray-800">{brief.plan}</dd>
          </div>
        )}
        {brief.tips.length > 0 && (
          <div>
            <dt className="text-xs font-bold text-gray-500">💡 {t("알아 두면 좋은 것")}</dt>
            {brief.tips.map((x) => (
              <dd key={x} className="mt-1 text-[13px] text-gray-800">
                · {x}
              </dd>
            ))}
          </div>
        )}
      </dl>
      <p className="mt-3 text-[11px] text-gray-500">
        {brief.source === "ai" ? t("AI가 웹 검색으로 정리 · {date} 기준 · 요금과 시간은 바뀔 수 있어요", { date: brief.updated }) : t("기본 정보만 보여 드려요 · {date} 기준", { date: brief.updated })}
      </p>
    </section>
  );
}
