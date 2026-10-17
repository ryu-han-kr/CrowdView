"use client";

import Link from "@/i18n/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { PhotoCard, type PhotoCardItem } from "./home/PhotoRail";
import { SpotMap, ViewToggle } from "./map/SpotMap";
import { StickyBar } from "./StickyBar";

export interface ExploreRegion {
  id: string;
  landmarks: (PhotoCardItem & { kind: string })[];
  festivals: PhotoCardItem[];
}

/** 지역 여행: 지역 칩 → 그 지역 대표 명소(종류 칩) + 축제. ?region= 으로 바로 연다 */
export function ExploreView({ regions, kinds }: { regions: ExploreRegion[]; kinds: { id: string; label: string; emoji: string }[] }) {
  const { t } = useI18n();
  const [region, setRegion] = useState(regions[0]?.id);
  const [kind, setKind] = useState<string>("all");
  const [view, setView] = useState<"list" | "map">("list");

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("region");
    if (r && regions.some((x) => x.id === r)) setRegion(r);
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const choose = (id: string) => {
    setRegion(id);
    setKind("all");
    const url = new URL(window.location.href);
    url.searchParams.set("region", id);
    window.history.replaceState(null, "", url);
  };

  const cur = regions.find((r) => r.id === region);
  const landmarks = (cur?.landmarks ?? []).filter((l) => kind === "all" || l.kind === kind);
  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`;

  return (
    <div>
      <StickyBar className="-mx-5 px-5 py-3 md:mx-0 md:px-0">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {regions.map((r) => (
            <button key={r.id} onClick={() => choose(r.id)} className={chip(r.id === region)}>
              {t(r.id)}
              <span className="ml-1 text-xs opacity-60">{r.landmarks.length + r.festivals.length}</span>
            </button>
          ))}
        </div>
      </StickyBar>

      {cur && view === "map" && (
        <section className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold md:text-xl">{t("{region} 명소·축제 지도", { region: t(cur.id) })}</h2>
            <ViewToggle view={view} onChange={setView} />
          </div>
          <SpotMap
            className="mt-3"
            spots={[...landmarks.map((l) => ({ ...l, emoji: "📍" })), ...cur.festivals.map((f) => ({ ...f, emoji: "🎪" }))]
              .filter((x): x is typeof x & { lat: number; lng: number } => x.lat !== undefined && x.lng !== undefined)
              .map((x) => ({
                id: x.id,
                name: x.title,
                lat: x.lat,
                lng: x.lng,
                href: x.href,
                external: x.external,
                score: x.score,
                emoji: x.emoji,
                sub: x.sub,
                img: x.img,
              }))}
          />
        </section>
      )}
      {cur && view === "list" && (
        <>
          <section className="mt-4">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-lg font-bold md:text-xl">{t("{region} 대표 명소", { region: t(cur.id) })}</h2>
              <div className="flex shrink-0 items-center gap-3">
                {cur.id === "서울" && (
                  <Link href="/guide" className="hidden text-sm text-indigo-600 sm:block">
                    {t("서울 여행 가이드")} ›
                  </Link>
                )}
                <ViewToggle view={view} onChange={setView} />
              </div>
            </div>
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
              <button onClick={() => setKind("all")} className={chip(kind === "all")}>
                {t("전체")}
              </button>
              {kinds
                .filter((k) => cur.landmarks.some((l) => l.kind === k.id))
                .map((k) => (
                  <button key={k.id} onClick={() => setKind(k.id)} className={chip(kind === k.id)}>
                    {k.emoji} {t(k.label)}
                  </button>
                ))}
            </div>
            {landmarks.length ? (
              <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5 md:gap-x-4">
                {landmarks.map((l) => (
                  <li key={l.id}>
                    <PhotoCard item={l} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                {t("아직 고른 명소가 없어요. 축제를 확인해 보세요.")}
              </p>
            )}
          </section>

          <section className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-lg font-bold md:text-xl">{t("{region} 축제", { region: t(cur.id) })}</h2>
              <Link href="/events" className="shrink-0 text-sm text-gray-500">
                {t("전국 축제")} ›
              </Link>
            </div>
            {cur.festivals.length ? (
              <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5 md:gap-x-4">
                {cur.festivals.map((f) => (
                  <li key={f.id}>
                    <PhotoCard item={f} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">{t("앞으로 60일 안에 열리는 축제가 없어요.")}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
