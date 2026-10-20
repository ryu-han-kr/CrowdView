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
        <ul className="mt-2 card divide-y divide-gray-100 p-0">
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
        <p className="mt-2 empty-note">{t("장소나 서울 실시간 지역 화면에서 🔔 알림을 켜면 여기에 모여요.")}</p>
      )}
    </section>
  );
}

interface TripRow {
  placeId: string;
  date: string;
  name: string;
  href?: string;
}

/** 마이 탭: 저장한 여행 날짜 (Plus). 그날 예측이 바뀌거나 전날 아침에 알림이 와요 */
export function TripsList({ enabled }: { enabled: boolean }) {
  const { t, lang } = useI18n();
  const { data } = useSession();
  const [rows, setRows] = useState<TripRow[] | null>(null);

  useEffect(() => {
    if (!enabled || !data?.user) return;
    fetch("/api/trips")
      .then((r) => (r.ok ? r.json() : { trips: [] }))
      .then((j: { trips: TripRow[] }) => setRows(j.trips))
      .catch(() => setRows([]));
  }, [enabled, data?.user]);

  if (!enabled || !data?.user || !rows?.length) return null;
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(lang, { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const remove = async (r: TripRow) => {
    await fetch("/api/trips", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId: r.placeId, date: r.date }) });
    setRows((rs) => rs?.filter((x) => !(x.placeId === r.placeId && x.date === r.date)) ?? null);
  };
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-lg font-bold">
        <Glyph e="📅" className="h-5 w-5 text-indigo-500" /> {t("저장한 여행 날짜")}
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">{t("그날 예측이 바뀌거나 전날 아침이 되면 알려 드려요")}</p>
      <ul className="mt-2 card divide-y divide-gray-100 p-0">
        {rows.map((r) => (
          <li key={`${r.placeId}-${r.date}`} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              {r.href ? (
                <Link href={r.href} className="block truncate text-sm font-semibold">
                  {t(r.name)}
                </Link>
              ) : (
                <span className="block truncate text-sm font-semibold">{r.name}</span>
              )}
              <span className="block text-xs text-gray-500">{fmt(r.date)}</span>
            </span>
            <button onClick={() => remove(r)} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {t("지우기")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
