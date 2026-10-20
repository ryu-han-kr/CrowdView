"use client";

import { useEffect, useState } from "react";
import Link from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import { useSession } from "@/lib/auth-client";
import { getPushSubscription } from "@/lib/plus-browser";
import { usePlus } from "@/lib/plus-client";
import { Glyph } from "@/components/Glyph";

// 한 화면에 버튼이 여러 번 그려져도(이번 주·달력) 저장 목록은 한 번만 불러온다
let cache: Promise<{ placeId: string; date: string }[]> | null = null;
const loadTrips = () =>
  (cache ??= fetch("/api/trips")
    .then((r) => (r.ok ? r.json() : { trips: [] }))
    .then((j: { trips: { placeId: string; date: string }[] }) => j.trips)
    .catch(() => []));

/**
 * '이 날 가요' (Plus): 여행 날짜를 저장하면 그날 예측이 바뀔 때, 그리고 전날 아침에 알림.
 * 레퍼런스: TouringPlans 'Crowd change notifications for YOUR dates'
 */
export function TripWatchButton({ placeId, date, enabled }: { placeId: string; date: string; enabled: boolean }) {
  const { t, lang } = useI18n();
  const { data } = useSession();
  const plus = usePlus();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !data?.user || !plus) return;
    loadTrips().then((trips) => setSaved(trips.some((x) => x.placeId === placeId && x.date === date)));
  }, [enabled, data?.user, plus, placeId, date]);

  if (!enabled) return null;
  if (!plus)
    return (
      <Link href="/pricing" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">
        <Glyph e="🔔" className="h-4 w-4" /> {t("이 날 가요 · 예측이 바뀌면 알림")}
        <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white">Plus</span>
      </Link>
    );

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (saved) {
        await fetch("/api/trips", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId, date }) });
      } else {
        const subscription = await getPushSubscription();
        const res = await fetch("/api/trips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ placeId, date, subscription, lang }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      }
      cache = null;
      setSaved(!saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${
          saved ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 ring-1 ring-indigo-200"
        }`}
      >
        <Glyph e={saved ? "✓" : "🔔"} className="h-4 w-4" />
        {saved ? t("이 날 저장됨 · 예측이 바뀌면 알려 드려요") : t("이 날 가요 · 예측이 바뀌면 알림")}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
