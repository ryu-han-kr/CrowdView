"use client";

import Link from "@/i18n/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSession } from "@/lib/auth-client";
import { usePlus } from "@/lib/plus-client";
import { Glyph } from "@/components/Glyph";

interface AlertRow {
  placeId: string;
  kind: "calm" | "busy";
  name: string;
  href?: string;
}

/** 마이 탭: 켜 둔 혼잡 알림 모아보기 · 하나씩 끄기 · 모두 끄기 (Plus, 로그인) */
export function AlertsList({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const { data } = useSession();
  const plus = usePlus();
  const [rows, setRows] = useState<AlertRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled || !data?.user) return;
    fetch("/api/alerts")
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((j: { alerts: AlertRow[] }) => setRows(j.alerts))
      .catch(() => setRows([]));
  }, [enabled, data?.user]);

  if (!enabled || !data?.user || (!plus && !rows?.length)) return null;

  const off = async (body: object, keep: (r: AlertRow) => boolean) => {
    setBusy(true);
    try {
      await fetch("/api/alerts", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setRows((rs) => rs?.filter(keep) ?? null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-lg font-bold">
          <Glyph e="🔔" className="h-5 w-5 text-indigo-500" /> {t("내 혼잡 알림")}
        </h2>
        {!!rows?.length && (
          <button disabled={busy} onClick={() => off({ all: true }, () => false)} className="text-xs font-semibold text-gray-500">
            {t("모두 끄기")}
          </button>
        )}
      </div>
      {rows === null ? (
        <p className="mt-2 text-sm text-gray-400">{t("불러오는 중…")}</p>
      ) : rows.length ? (
        <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-100">
          {rows.map((r) => (
            <li key={`${r.placeId}-${r.kind}`} className="flex items-center gap-3 px-4 py-3">
              <Glyph e={r.kind === "calm" ? "🌿" : "🔥"} className={`h-5 w-5 ${r.kind === "calm" ? "text-emerald-500" : "text-rose-500"}`} />
              <span className="min-w-0 flex-1">
                {r.href ? (
                  <Link href={r.href} className="block truncate text-sm font-semibold">
                    {t(r.name)}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                )}
                <span className="block text-xs text-gray-500">{r.kind === "calm" ? t("한산해지면 알림") : t("붐비기 시작하면 알림")}</span>
              </span>
              <button
                disabled={busy}
                onClick={() => off({ placeId: r.placeId, kind: r.kind }, (x) => !(x.placeId === r.placeId && x.kind === r.kind))}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600"
              >
                {t("끄기")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">{t("장소나 서울 실시간 지역 화면에서 🔔 알림을 켜면 여기에 모여요.")}</p>
      )}
    </section>
  );
}
