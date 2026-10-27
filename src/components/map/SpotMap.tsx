"use client";

// 목록 화면의 '지도로 보기': 지금 고른 탭·조건의 장소를 지도에 혼잡도 색 핀으로 찍는다.
// 네이버 지도 키가 없거나 실패하면 위치만 찍은 간단한 그림으로 대체
import Link from "@/i18n/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Character } from "@/components/Character";
import { useI18n } from "@/i18n/client";
import { LEVELS, levelOf, deepOf } from "@/lib/levels";
import { KEY_ID, loadSdk } from "@/lib/naver-map";
import { MAP_PREVIEW_H, MAP_PREVIEW_W, projectToPreview } from "@/lib/map-preview";
import { LevelBadge } from "../Level";
import { MapLegend } from "./MapLegend";
import { Glyph } from "@/components/Glyph";

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
/** 이보다 많으면 핀을 묶는다 */
const CLUSTER_FROM = 40;
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
          className={`min-h-8 rounded-full px-3 py-1.5 ${view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
        >
          <Glyph e={v === "list" ? "☰" : "🗺️"} /> {v === "list" ? t("목록") : t("지도")}
        </button>
      ))}
    </div>
  );
}

/** max: 한 번에 그릴 최대 핀 (기본 400, 묶음이 있어 더 늘려도 된다) · legend=false면 위 범례를 숨긴다 (부르는 쪽이 따로 그릴 때)
 *  preview=true: 타일이 뜰 때까지 전국 정적 그림 위에 핀을 찍어 둔다 (전국 지도 화면용. 지역 일부만 찍는 목록 지도에는 안 맞는다) */
export function SpotMap({
  spots,
  className = "",
  max = MAX_PINS,
  legend = true,
  heightClass,
  preview = false,
}: {
  spots: MapSpot[];
  className?: string;
  max?: number;
  legend?: boolean;
  heightClass?: string;
  preview?: boolean;
}) {
  const shown = useMemo(() => spots.slice(0, max), [spots, max]);
  const [failed, setFailed] = useState(!KEY_ID);
  const [selected, setSelected] = useState<string | null>(null);
  const { t } = useI18n();
  const sel = shown.find((s) => s.id === selected);
  const counts = LEVELS.map((l) => shown.filter((s) => s.score !== undefined && levelOf(s.score).key === l.key).length);

  return (
    <div className={className}>
      {legend && <MapLegend counts={counts} className="mb-2" />}
      {/* 시험용 표시 (QA 10/21 MAP-01): 지도에 넘긴 곳 수. 핀마다 data-place-id·data-level, 묶음은 data-cluster-ids */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-100" data-testid="spot-map" data-spot-count={shown.length}>
        {/* 인증 실패 때 지도를 바로 없애면 네이버 SDK 안쪽 오류로 화면 전체가 멈췄다 → 숨겨 두고 그림을 보인다 (자체 QA 10/22) */}
        {KEY_ID && (
          <div className={failed ? "hidden" : undefined} aria-hidden={failed || undefined}>
            <NaverSpots spots={shown} onSelect={setSelected} onFail={() => setFailed(true)} heightClass={heightClass} preview={preview} />
          </div>
        )}
        {failed && <SketchMap spots={shown} onSelect={setSelected} />}
        {spots.length > max && (
          <p className="absolute top-3 left-3 z-10 rounded-full bg-white/95 px-2.5 py-1 text-[11px] text-gray-600 shadow">
            {t("앞쪽 {n}곳만 보여요", { n: max })}
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
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
          <Glyph e={spot.emoji ?? "📍"} className="h-6 w-6" />
        </span>
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
    <div className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-2 rounded-3xl bg-white p-3 shadow-xl" data-selected-id={spot.id}>
      {spot.external ? (
        <a href={spot.href} target="_blank" rel="noreferrer" className={cls}>
          {body}
        </a>
      ) : (
        <Link href={spot.href} className={cls}>
          {body}
        </Link>
      )}
      <button onClick={onClose} aria-label="close" className="px-1 text-gray-500">
        <Glyph e="✕" className="h-4 w-4" />
      </button>
    </div>
  );
}

function NaverSpots({
  spots,
  onSelect,
  onFail,
  heightClass = "h-[60dvh] min-h-[380px]",
  preview = false,
}: {
  spots: MapSpot[];
  onSelect: (id: string | null) => void;
  onFail: () => void;
  heightClass?: string;
  preview?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(0);
  // 타일까지 다 그려졌는지 (그 전까지 미리보기·대기 화면을 덮어 둔다). tilesloaded 가 안 오는 경우를 위해 8초 뒤엔 걷는다
  const [tiles, setTiles] = useState(false);
  // 미리보기 그림이 화면에 한 번은 그려졌는지. 빠른 망에선 첫 그림이 뜨기도 전에 타일이 다 와서 미리보기가 그려지지 않은 채 걷혔다
  // (10/27 Lighthouse: 관찰 LCP 가 그대로 타일 → 느린 망 시뮬레이션 5.7초). 그려진 뒤에만 걷어 첫 그림(LCP)이 미리보기가 되게 한다
  const [painted, setPainted] = useState(false);
  const hideOverlay = tiles && (!preview || painted);
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
        try {
          maps.Event.once(mapRef.current, "tilesloaded", () => setTiles(true));
        } catch {}
        setTimeout(() => setTiles(true), 8000);
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

  // 핀 그리기: 40곳이 넘으면 확대 수준에 맞춰 가까운 핀을 숫자 원으로 묶는다 (지도를 움직일 때마다 다시)
  const { t } = useI18n();
  const draw = () => {
    const map = mapRef.current;
    const maps = window.naver?.maps;
    if (!map || !maps) return;
    for (const m of markersRef.current) m.setMap(null);
    const zoom = map.getZoom();
    // 화면에서 약 60px 크기의 칸 (경도 기준 근사)
    const cell = spots.length > CLUSTER_FROM && zoom < 16 ? (60 * 360) / (256 * 2 ** zoom) : 0;
    const groups = new Map<string, MapSpot[]>();
    for (const sp of spots) {
      const key = cell ? `${Math.floor(sp.lat / cell)}:${Math.floor(sp.lng / cell)}` : sp.id;
      groups.set(key, [...(groups.get(key) ?? []), sp]);
    }
    markersRef.current = [...groups.values()].map((g) => {
      if (g.length === 1) {
        const sp = g[0];
        const label = `${sp.name}${sp.score !== undefined ? ` · ${t(levelOf(sp.score).label)}` : ""}`;
        const marker = new maps.Marker({
          map,
          position: new maps.LatLng(sp.lat, sp.lng),
          title: label,
          icon: {
            content: `<div role="img" aria-label="${label.replace(/"/g, "&quot;")}" data-place-id="${sp.id}" data-level="${sp.score !== undefined ? levelOf(sp.score).key : "none"}" style="width:28px;height:28px;border-radius:9999px;background:#fff;border:3px solid ${pinColor(sp.score)};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.25);cursor:pointer">${sp.emoji ?? ""}</div>`,
            anchor: new maps.Point(14, 14),
          },
        });
        maps.Event.addListener(marker, "click", () => onSelect(sp.id));
        return marker;
      }
      // 묶음: 가운데에 숫자 원, 누르면 그쪽으로 두 단계 확대
      const lat = g.reduce((a, x) => a + x.lat, 0) / g.length;
      const lng = g.reduce((a, x) => a + x.lng, 0) / g.length;
      const size = g.length >= 50 ? 46 : g.length >= 10 ? 40 : 34;
      // 원 색 = 묶인 곳들의 평균 혼잡 단계 색 (위 범례와 같은 색). 단계를 아는 곳이 없으면 남색
      const scored = g.filter((x) => x.score !== undefined);
      const fill = scored.length ? pinColor(scored.reduce((a, x) => a + x.score!, 0) / scored.length) : "rgba(79,70,229,.88)";
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(lat, lng),
        title: t("{n}곳", { n: g.length }),
        icon: {
          content: `<div role="img" aria-label="${t("{n}곳", { n: g.length })}" data-cluster-ids="${g.map((x) => x.id).join(",")}" style="width:${size}px;height:${size}px;border-radius:9999px;background:${fill};color:${scored.length ? deepOf(pinColor(scored.reduce((a, x) => a + x.score!, 0) / scored.length)) : "#fff"};border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:700 13px system-ui;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer">${g.length}</div>`,
          anchor: new maps.Point(size / 2, size / 2),
        },
      });
      maps.Event.addListener(marker, "click", () => {
        map.setCenter(new maps.LatLng(lat, lng));
        map.setZoom(Math.min(zoom + 2, 17));
      });
      return marker;
    });
  };
  const drawRef = useRef(draw);
  drawRef.current = draw;

  // 목록이 바뀌면 모두 보이게 맞추고 다시 그린다
  useEffect(() => {
    const map = mapRef.current;
    const maps = window.naver?.maps;
    if (!map || !maps) return;
    if (spots.length === 1) {
      map.setCenter(new maps.LatLng(spots[0].lat, spots[0].lng));
      map.setZoom(15);
    } else if (spots.length > 1) {
      const bounds = new maps.LatLngBounds(new maps.LatLng(spots[0].lat, spots[0].lng), new maps.LatLng(spots[0].lat, spots[0].lng));
      for (const sp of spots) bounds.extend(new maps.LatLng(sp.lat, sp.lng));
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 90, left: 40 });
    }
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, ready]);

  // 확대 수준이 바뀌면 묶음을 다시 계산
  useEffect(() => {
    const map = mapRef.current;
    const maps = window.naver?.maps;
    if (!map || !maps) return;
    const listener = maps.Event.addListener(map, "zoom_changed", () => drawRef.current());
    // 지도 인증이 실패하면(키·도메인 문제) 그림 지도로 바뀌며 이 지도가 먼저 정리돼, 리스너를 지울 때 네이버 SDK가 오류를 던진다
    // → 지도 화면 전체가 오류 화면이 되던 것 (10/21 고정 자료 시험에서 발견)
    return () => {
      try {
        maps.Event.removeListener(listener);
      } catch {}
    };
  }, [ready]);

  return (
    <div className={`relative ${heightClass} w-full`}>
      <div ref={el} className="h-full w-full" />
      {/* 타일이 뜨기 전: 전국 지도 화면은 정적 그림 + 핀(첫 그림·LCP, 10/27), 그 외는 지도를 펼친 햄스터 */}
      {!hideOverlay &&
        (preview ? (
          <MapPreview spots={spots} onPainted={() => setPainted(true)} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gray-50 text-sm text-gray-500">
            <Character name="hamster" pose="explore" size={120} priority />
            {t("지도를 불러오는 중…")}
          </div>
        ))}
    </div>
  );
}

/** 네이버 타일이 뜨기 전 첫 그림: 한반도 남쪽 실루엣(public/map/korea.webp, 16KB) 위에 혼잡 색 점.
 *  그림과 점은 같은 투영(lib/map-preview)을 쓰고 둘 다 object-contain/meet 으로 맞춰 자리가 일치한다.
 *  지도 화면 LCP 가 타일(7~8초)이었던 것을 이 그림(HTML 에 바로 있는 img)으로 당긴다. 점 수는 400개까지 (서버 렌더 때는 283곳) */
function MapPreview({ spots, onPainted }: { spots: MapSpot[]; onPainted: () => void }) {
  const { t } = useI18n();
  const img = useRef<HTMLImageElement>(null);
  // 그림이 받아진 뒤 두 프레임을 기다리면 한 번은 화면에 그려진 것
  useEffect(() => {
    const el = img.current;
    if (!el) return;
    let raf = 0;
    const done = () => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => onPainted());
      });
    };
    if (el.complete) done();
    else el.addEventListener("load", done, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("load", done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 bg-[#e9f0fa]" aria-hidden data-testid="map-preview">
      <span className="absolute top-3 left-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-gray-600 shadow">{t("지도를 불러오는 중…")}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src="/map/korea.webp" width={MAP_PREVIEW_W} height={MAP_PREVIEW_H} alt="" fetchPriority="high" decoding="async" className="h-full w-full object-contain" />
      <svg viewBox={`0 0 ${MAP_PREVIEW_W} ${MAP_PREVIEW_H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
        {spots.slice(0, 400).map((s) => {
          const [x, y] = projectToPreview(s.lat, s.lng);
          return <circle key={s.id} cx={x} cy={y} r={7} fill={pinColor(s.score)} stroke="#fff" strokeWidth={2.5} />;
        })}
      </svg>
    </div>
  );
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
          data-place-id={s.id}
          data-level={s.score !== undefined ? levelOf(s.score).key : "none"}
          onClick={() => onSelect(s.id)}
        />
      ))}
    </svg>
  );
}
