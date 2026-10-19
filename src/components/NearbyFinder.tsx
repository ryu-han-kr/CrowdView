"use client";

import Link from "@/i18n/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { currentPosition, distanceKm, type LatLng } from "@/lib/geo";
import { Glyph } from "@/components/Glyph";

type Tab = "toilet" | "wifi" | "guide" | "culture" | "reservation";
const TABS: { id: Tab; label: string; emoji: string; file: (lang: string) => string }[] = [
  { id: "toilet", label: "화장실", emoji: "🚻", file: () => "toilets.json" },
  { id: "guide", label: "명소·맛집", emoji: "🍽️", file: (l) => `guide-${l}.json` },
  { id: "culture", label: "문화공간", emoji: "🎨", file: () => "culture.json" },
  { id: "reservation", label: "체험 예약", emoji: "🎟️", file: () => "reservations.json" },
  { id: "wifi", label: "무료 와이파이", emoji: "📶", file: () => "wifi.json" },
];
const KIND_EMOJI: Record<string, string> = { attraction: "🏛️", food: "🍽️", shopping: "🛍️", nature: "🌳" };

interface Item {
  key: string;
  name: string;
  lat: number;
  lng: number;
  sub?: string;
  badges?: string[];
  href?: string;
  external?: string;
  flags?: number;
}

interface Hub {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** 내 위치(또는 고른 곳) 주변 화장실·와이파이·명소·맛집·문화공간·체험 예약 */
export function NearbyFinder({ hubs, names = {}, initialTab = "toilet" }: { hubs: Hub[]; names?: Record<string, string>; initialTab?: Tab }) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [at, setAt] = useState<(LatLng & { name: string }) | null>(null);
  const [data, setData] = useState<Partial<Record<Tab, unknown[]>>>({});
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<number>(0);

  // 주소에 ?tab=toilet&lat=..&lng=.. 가 있으면 그곳에서 시작 (지역·장소 상세의 "근처 화장실" 링크)
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const qt = q.get("tab") as Tab | null;
    if (qt && TABS.some((x) => x.id === qt)) setTab(qt);
    const lat = Number(q.get("lat"));
    const lng = Number(q.get("lng"));
    if (lat && lng) setAt({ lat, lng, name: q.get("name") ?? t("고른 곳") });
  }, [t]);

  useEffect(() => {
    if (data[tab]) return;
    const def = TABS.find((x) => x.id === tab)!;
    fetch(`/data/${def.file(lang)}`)
      .then((r) => r.json())
      .then((rows: unknown[]) => setData((d) => ({ ...d, [tab]: rows })))
      .catch(() => setError(t("데이터를 불러오지 못했어요")));
  }, [tab, lang, data, t]);

  const locate = async () => {
    setError(null);
    try {
      setAt({ ...(await currentPosition()), name: t("내 위치") });
    } catch {
      setError(t("위치를 쓸 수 없어요. 브라우저에서 위치 권한을 허용해 주세요."));
    }
  };

  const items: Item[] = useMemo(() => {
    const rows = (data[tab] ?? []) as unknown[][];
    switch (tab) {
      case "toilet":
        return rows.map((r) => {
          const f = r[3] as number;
          return {
            key: `${r[0]}${r[1]}`,
            name: r[0] as string,
            lat: r[1] as number,
            lng: r[2] as number,
            flags: f,
            sub: [r[4] && (f & 1 ? t("24시간") : (r[4] as string)), r[5] && `${t("휴무")} ${r[5]}`].filter(Boolean).join(" · "),
            badges: [f & 2 && t("장애인"), f & 4 && t("기저귀 교환대"), f & 8 && t("비상벨"), f & 16 && t("민간 개방")].filter(Boolean) as string[],
          };
        });
      case "wifi":
        return rows.map((r) => ({
          key: `${r[1]}${r[2]}`,
          name: r[0] as string,
          lat: r[1] as number,
          lng: r[2] as number,
          sub: r[3] ? t("실외") : t("실내"),
        }));
      case "guide":
        return rows
          .filter((r) => r[3] !== null)
          .map((r) => ({
            key: r[0] as string,
            name: `${KIND_EMOJI[r[1] as string] ?? ""} ${r[2]}`,
            lat: r[3] as number,
            lng: r[4] as number,
            sub: (r[5] as string) ?? undefined,
            href: `/guide/${r[0]}`,
          }));
      case "culture":
        return rows.map((r) => ({ key: `${r[0]}${r[1]}`, name: r[0] as string, lat: r[1] as number, lng: r[2] as number, sub: r[3] as string }));
      case "reservation": {
        // 접수 마감이 지난 체험은 빼기 (데이터는 주 1회라 상태만으로는 늦다)
        const now = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
        return rows
          .filter((r) => !r[6] || String(r[6]) >= now)
          .map((r) => ({
            key: r[5] as string,
            name: r[0] as string,
            lat: r[1] as number,
            lng: r[2] as number,
            sub: `${r[3]} · ${r[4]}${r[6] ? ` · ${t("접수 마감")} ${String(r[6]).slice(5, 10)}` : ""}`,
            external: r[5] as string,
          }));
      }
    }
  }, [data, tab, t]);

  const list = useMemo(() => {
    if (!at) return [];
    return items
      .filter((x) => tab !== "toilet" || (filters & (x.flags ?? 0)) === filters)
      .map((x) => ({ ...x, km: distanceKm(at, x) }))
      .filter((x) => x.km <= 3)
      .sort((a, b) => a.km - b.km)
      .slice(0, 30);
  }, [items, at, filters, tab]);

  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${on ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`;

  return (
    <div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} className={chip(tab === x.id)}>
            <Glyph e={x.emoji} /> {t(x.label)}
          </button>
        ))}
      </div>

      <button
        onClick={locate}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold ${
          at?.name === t("내 위치") ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700"
        }`}
      >
        <Glyph e="📍" /> {at?.name === t("내 위치") ? t("내 위치 기준") : t("내 위치 사용하기")}
      </button>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
        {hubs.map((h) => (
          <button key={h.id} onClick={() => setAt({ lat: h.lat, lng: h.lng, name: h.name })} className={chip(at?.name === h.name)}>
            {names[h.name] ?? h.name}
          </button>
        ))}
      </div>

      {tab === "toilet" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            [1, "24시간"],
            [2, "장애인"],
            [4, "기저귀 교환대"],
            [8, "비상벨"],
          ].map(([bit, label]) => {
            const on = (filters & (bit as number)) !== 0;
            return (
              <button
                key={bit}
                aria-pressed={on}
                onClick={() => setFilters(filters ^ (bit as number))}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600"}`}
              >
                {t(label as string)}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      {!at ? (
        <p className="mt-6 empty-note p-5">{t("내 위치를 켜거나 위에서 장소를 고르면 가까운 곳부터 보여드려요.")}</p>
      ) : !data[tab] ? (
        <p className="mt-6 text-sm text-gray-500">{t("불러오는 중…")}</p>
      ) : list.length === 0 ? (
        <p className="mt-6 empty-note p-5">{t("3km 안에 찾는 곳이 없어요.")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-100">
          {list.map((x) => {
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{x.name}</span>
                  {x.sub && <span className="block truncate text-xs text-gray-500">{x.sub}</span>}
                  {x.badges && x.badges.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {x.badges.map((b) => (
                        <span key={b} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                          {b}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right text-xs">
                  <b>{x.km < 1 ? `${Math.round(x.km * 1000)}m` : `${x.km.toFixed(1)}km`}</b>
                  <span className="block text-gray-400">{t("도보 {n}분", { n: Math.max(1, Math.round((x.km * 1.3 * 60) / 4.5)) })}</span>
                </span>
              </>
            );
            return (
              <li key={x.key} className="flex items-center gap-2 px-4 py-3">
                {x.href ? (
                  <Link href={x.href} className="flex min-w-0 flex-1 items-center gap-3">
                    {body}
                  </Link>
                ) : x.external ? (
                  <a href={x.external} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
                    {body}
                  </a>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>
                )}
                <a
                  href={`https://map.kakao.com/link/to/${encodeURIComponent(x.name.replace(/^\S+\s/, ""))},${x.lat},${x.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                >
                  {t("길찾기")}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-[11px] text-gray-400">
        {t("서울시 공중화장실·공공와이파이·문화공간·공공서비스예약, Visit Seoul (서울 열린데이터광장, 주 1회 갱신)")}
      </p>
    </div>
  );
}
