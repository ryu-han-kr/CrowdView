"use client";

import Link from "@/i18n/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSession } from "@/lib/auth-client";
import { getPushSubscription } from "@/lib/plus-browser";
import { usePlus } from "@/lib/plus-client";
import { Glyph } from "@/components/Glyph";

type Kind = "calm" | "busy";

/** 장소 상세의 혼잡 알림 켜기/끄기 (Plus). Plus가 아니면 안내 링크 */
export function AlertButtons({ placeId, enabled }: { placeId: string; enabled: boolean }) {
  return enabled ? <Inner placeId={placeId} /> : null;
}

function Inner({ placeId }: { placeId: string }) {
  const { t, lang } = useI18n();
  const { data } = useSession();
  const plus = usePlus();
  const [on, setOn] = useState<Record<Kind, boolean>>({ calm: false, busy: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.user || !plus) return;
    fetch("/api/alerts")
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((j: { alerts: { placeId: string; kind: Kind }[] }) =>
        setOn({
          calm: j.alerts.some((a) => a.placeId === placeId && a.kind === "calm"),
          busy: j.alerts.some((a) => a.placeId === placeId && a.kind === "busy"),
        }),
      )
      .catch(() => {});
  }, [data?.user, plus, placeId]);

  const toggle = async (kind: Kind) => {
    setError(null);
    try {
      if (on[kind]) {
        await fetch("/api/alerts", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId, kind }) });
      } else {
        const subscription = await getPushSubscription();
        const res = await fetch("/api/alerts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ placeId, kind, subscription, lang }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      }
      setOn((s) => ({ ...s, [kind]: !s[kind] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="card mt-4">
      <p className="flex items-center gap-1 text-sm font-bold">
        <Glyph e="🔔" className="h-4 w-4 text-indigo-500" /> {t("혼잡 알림")}{" "}
        <span className="ml-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white">Plus</span>
      </p>
      {plus ? (
        <div className="mt-3 flex gap-2">
          {(["calm", "busy"] as const).map((k) => (
            <button
              key={k}
              onClick={() => toggle(k)}
              aria-pressed={on[k]}
              className={`flex-1 rounded-2xl px-3 py-2.5 text-xs font-semibold ${on[k] ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              {k === "calm" ? t("한산해지면 알림") : t("붐비기 시작하면 알림")}
              {on[k] && <Glyph e="✓" className="ml-1 h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      ) : (
        <Link href="/pricing" className="mt-2 block text-xs text-indigo-600">
          {t("Plus로 이 장소가 한산해질 때 알림을 받아 보세요")} ›
        </Link>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
