"use client";

import Link from "@/i18n/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSession } from "@/lib/auth-client";
import { getPushSubscription } from "@/lib/plus-browser";
import { usePlus } from "@/lib/plus-client";
import { Glyph } from "@/components/Glyph";

type Kind = "calm" | "busy";

/** 장소 상세의 혼잡 알림 켜기/끄기. 로그인한 회원은 누구나 1개(무료), Plus는 30개. 로그인 전에는 '한산해지면' 한 번 알림 (lib/alerts-anon) */
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
    if (!data?.user) return;
    fetch("/api/alerts")
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((j: { alerts: { placeId: string; kind: Kind }[] }) =>
        setOn({
          calm: j.alerts.some((a) => a.placeId === placeId && a.kind === "calm"),
          busy: j.alerts.some((a) => a.placeId === placeId && a.kind === "busy"),
        }),
      )
      .catch(() => {});
  }, [data?.user, placeId]);

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
        {plus && <span className="ml-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white">Plus</span>}
      </p>
      {data?.user ? (
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
        <AnonAlert placeId={placeId} />
      )}
      {data?.user && !plus && (
        <p className="mt-2 text-[11px] text-gray-500">
          {t("무료는 알림 1개 · Plus는 30개")}{" "}
          <Link href="/pricing" className="text-indigo-600">
            {t("Plus 알아보기")} ›
          </Link>
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}

const anonPost = async (body: Record<string, unknown>) => {
  const res = await fetch("/api/alerts/anon", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as { placeId?: string | null; calmNow?: boolean };
};

/** 로그인 없이: 이 브라우저에서 한 곳, 한산해지면 한 번 알리고 끝 (7일). 로그인하면 계속·붐빔 알림도 */
function AnonAlert({ placeId }: { placeId: string }) {
  const { t, lang } = useI18n();
  const [on, setOn] = useState(false);
  const [calmNow, setCalmNow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 이미 알림을 허용한 브라우저만 상태를 묻는다 (권한 창을 먼저 띄우지 않게)
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => sub && anonPost({ action: "status", endpoint: sub.endpoint }))
      .then((r) => r && setOn(r.placeId === placeId))
      .catch(() => {});
  }, [placeId]);

  const toggle = async () => {
    setError(null);
    try {
      const subscription = await getPushSubscription();
      if (on) await anonPost({ action: "off", endpoint: subscription.endpoint });
      else setCalmNow(!!(await anonPost({ action: "on", placeId, subscription, lang })).calmNow);
      setOn(!on);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <button
        onClick={toggle}
        aria-pressed={on}
        className={`mt-3 w-full rounded-2xl px-3 py-2.5 text-xs font-semibold ${on ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"}`}
      >
        {t("한산해지면 알림")}
        {on && <Glyph e="✓" className="ml-1 h-3.5 w-3.5" />}
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
        {on && calmNow ? t("지금도 한산해요. 붐볐다가 다시 한산해지면 알려 드려요") : t("로그인 없이 한 번 알려 드려요 (7일 동안)")}{" "}
        <Link href="/me" className="text-indigo-600 underline">
          {t("로그인하면 붐빔 알림도")} ›
        </Link>
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </>
  );
}
