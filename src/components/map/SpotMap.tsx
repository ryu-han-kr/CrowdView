"use client";

// 목록 화면의 '지도로 보기': 지금 고른 탭·조건의 장소를 지도에 혼잡도 색 핀으로 찍는다.
// 네이버 지도 키가 없거나 실패하면 위치만 찍은 간단한 그림으로 대체
import Link from "@/i18n/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { LEVELS, levelOf } from "@/lib/levels";
import { KEY_ID, loadSdk } from "@/lib/naver-map";
import { LevelBadge } from "../Level";
import { MapLegend } from "./MapLegend";

export interface MapSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  href: string;
  external?: boolean;
  /** 혼잡 점수 (없으면 회색 핀) */
  score?: number;
  emoji?: string;
  sub?: string;
  img?: string;
}

const MAX_PINS = 400;
const pinColor = (s?: number) => (s === undefined ? "#94a3b8" : levelOf(s).color);

/** 목록 ↔ 지도 전환 버튼 */
export function ViewToggle({ view, onChange }: { view: "list" | "map"; onChange: (v: "list" | "map") => void }) {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
      {(["list", "map"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          className={`rounded-full px-3 py-1 ${view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
        >
          {v === "list" ? `☰ ${t("목록")}` : `🗺️ ${t("지도")}`}
        </button>
      ))}
    </div>
  );
}

export function SpotMap({ spots, className = "" }: { spots: MapSpot[]; className?: string }) {
  const shown = useMemo(() => spots.slice(0, MAX_PINS), [spots]);
  const [failed, setFailed] = useState(!KEY_ID);
  const [selected, setSelected] = useState<string | null>(null);
  const { t } = useI18n();
  const sel = shown.find((s) => s.id === selected);
  const counts = LEVELS.map((l) => shown.filter((s) => s.score !== undefined && levelOf(s.score).key === l.key).length);

  return (
    <div className={className}>
      <MapLegend counts={counts} className="mb-2" />
      <div className="relative overflow-hidden rounded-3xl bg-slate-100">
        {failed ? (
          <SketchMap spots={shown} onSelect={setSelected} />
        ) : (
          <NaverSpots spots={shown} onSelect={setSelected} onFail={() => setFailed(true)} />
        )}
        {spots.length > MAX_PINS && (
          <p className="absolute top-3 left-3 z-10 rounded-full bg-white/95 px-2.5 py-1 text-[11px] text-gray-600 shadow">
            {t("앞쪽 {n}곳만 보여요", { n: MAX_PINS })}
          </p>
        )}
        {sel && <SpotCard spot={sel} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function SpotCard({ spot, onClose }: { spot: MapSpot; onClose: () => void }) {
  const body = (
    <>
      {spot.img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={spot.img} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl">{spot.emoji ?? "📍"}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{spot.name}</span>
        {spot.sub && <span className="block truncate text-xs text-gray-500">{spot.sub}</span>}
      </span>
      {spot.score !== undefined && <LevelBadge score={spot.score} />}
    </>
  );
  const cls = "flex min-w-0 flex-1 items-center gap-3";
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-2 rounded-3xl bg-white p-3 shadow-xl">
      {spot.external ? (
        <a href={spot.href} target="_blank" rel="noreferrer" className={cls}>
          {body}
        </a>
      ) : (
        <Link href={spot.href} className={cls}>
          {body}
        </Link>
      )}
      <button onClick={onClose} aria-label="close" className="px-1 text-gray-400">
        ✕
      </button>
    </div>
  );
}

function NaverSpots({ spots, onSelect, onFail }: { spots: MapSpot[]; onSelect: (id: string | null) => void; onFail: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(0);
  const { lang } = useI18n();

  // 지도는 한 번만 만든다
  useEffect(() => {
    let cancelled = false;
    window.navermap_authFailure = () => onFail();
    loadSdk(KEY_ID!, lang)
      .then(() => {
        if (cancelled || !el.current) return;
        const { maps } = window.naver;
        mapRef.current = new maps.Map(el.current, { center: new maps.LatLng(37.55, 126.98), zoom: 11, scaleControl: false, mapDataControl: false });
        maps.Event.addListener(mapRef.current, "click", () => onSelect(null));
        setReady((n) => n + 1);
      })
      .catch(() => onFail());
    return () => {
      cancelled = true;
      window.navermap_authFailure = undefined;
      try {
        mapRef.current?.destroy?.();
      } catch {}
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 핀은 목록이 바뀔 때마다 다시 찍고, 모두 보이게 맞춘다
  useEffect(() => {
    const map = mapRef.current;
    const maps = window.naver?.maps;
    if (!map || !maps) return;
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = spots.map((s) => {
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(s.lat, s.lng),
        title: s.name,
        icon: {
          content: `<div style="width:28px;height:28px;border-radius:9999px;background:#fff;border:3px solid ${pinColor(s.score)};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.25);cursor:pointer">${s.emoji ?? ""}</div>`,
          anchor: new maps.Point(14, 14),
        },
      });
      maps.Event.addListener(marker, "click", () => onSelect(s.id));
      return marker;
    });
    if (spots.length === 1) {
      map.setCenter(new maps.LatLng(spots[0].lat, spots[0].lng));
      map.setZoom(15);
    } else if (spots.length > 1) {
      const bounds = new maps.LatLngBounds(new maps.LatLng(spots[0].lat, spots[0].lng), new maps.LatLng(spots[0].lat, spots[0].lng));
      for (const s of spots) bounds.extend(new maps.LatLng(s.lat, s.lng));
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 90, left: 40 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, ready]);

  return <div ref={el} className="h-[60dvh] min-h-[380px] w-full" />;
}

/** 지도 키가 없을 때: 위치를 비율대로 찍은 간단한 그림 */
function SketchMap({ spots, onSelect }: { spots: MapSpot[]; onSelect: (id: string) => void }) {
  if (!spots.length) return <div className="h-[60dvh] min-h-[380px]" />;
  const lats = spots.map((s) => s.lat);
  const lngs = spots.map((s) => s.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = Math.max(maxLat - minLat, (maxLng - minLng) * 0.8, 0.01);
  return (
    <svg viewBox="0 0 400 300" className="h-[60dvh] min-h-[380px] w-full bg-sky-50" role="img" aria-label="map">
      {spots.map((s) => (
        <circle
          key={s.id}
          cx={30 + ((s.lng - minLng) * 0.8 * 340) / span}
          cy={270 - ((s.lat - minLat) * 240) / span}
          r={6}
          fill={pinColor(s.score)}
          stroke="white"
          strokeWidth={2}
          className="cursor-pointer"
          onClick={() => onSelect(s.id)}
        />
      ))}
    </svg>
  );
}
