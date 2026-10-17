"use client";

// 네이버 지도 위에 혼잡도 원과 장소 핀을 그린다.
// 키가 없거나 인증·로딩에 실패하면 자체 SVG 히트맵으로 대체.
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { LEVELS, levelOf } from "@/lib/levels";
import type { CrowdResult, Place } from "@/lib/types";
import { KEY_ID, loadSdk } from "@/lib/naver-map";
import { HeatMap, MapPlaceCard } from "./HeatMap";
import { MapLegend } from "./map/MapLegend";

const REGIONS = {
  all: { label: "전국", lat: 36.0, lng: 127.6, zoom: 7 },
  capital: { label: "수도권", lat: 37.45, lng: 126.85, zoom: 9 },
  busan: { label: "부산", lat: 35.16, lng: 129.04, zoom: 11 },
  jeju: { label: "제주", lat: 33.42, lng: 126.55, zoom: 10 },
} as const;
type RegionKey = keyof typeof REGIONS;

/** 혼잡도 원 반지름(m). 확대 단계와 상관없이 화면에서 12~36px로 보이게 맞춘다 */
function circleRadius(score: number, zoom: number, lat: number): number {
  const metersPerPx = (156543 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return (12 + score * 0.24) * metersPerPx;
}

export function CrowdMap({ places, crowd }: { places: Place[]; crowd: Record<string, CrowdResult> }) {
  const [failed, setFailed] = useState(!KEY_ID);
  return (
    <div className="relative">
      {failed ? <HeatMap places={places} crowd={crowd} /> : <NaverCrowdMap places={places} crowd={crowd} onFail={() => setFailed(true)} />}
      <MapLegend counts={LEVELS.map((l) => places.filter((p) => crowd[p.id]?.open && levelOf(crowd[p.id].score).key === l.key).length)} />
    </div>
  );
}

function NaverCrowdMap({
  places,
  crowd,
  onFail,
}: {
  places: Place[];
  crowd: Record<string, CrowdResult>;
  onFail: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [region, setRegion] = useState<RegionKey>("capital");
  const [selected, setSelected] = useState<string | null>(null);
  const { t, lang } = useI18n();

  useEffect(() => {
    let cancelled = false;
    // 네이버 지도는 인증 실패 시 이 전역 콜백을 호출한다
    window.navermap_authFailure = () => {
      console.warn("[CrowdMap] 네이버 지도 인증 실패 — 서비스 URL 등록 여부를 확인하세요.");
      onFail();
    };

    loadSdk(KEY_ID!, lang)
      .then(() => {
        if (cancelled || !el.current) return;
        const { maps } = window.naver;
        const r = REGIONS.capital;
        const circles: { circle: any; score: number; lat: number }[] = [];
        const map = new maps.Map(el.current, {
          center: new maps.LatLng(r.lat, r.lng),
          zoom: r.zoom,
          scaleControl: false,
          mapDataControl: false,
        });
        mapRef.current = map;
        maps.Event.addListener(map, "click", () => setSelected(null));

        for (const p of places) {
          const c = crowd[p.id];
          const position = new maps.LatLng(p.lat, p.lng);
          const color = c.open ? levelOf(c.score).color : "#94a3b8";
          if (c.open) {
            const circle = new maps.Circle({
              map,
              center: position,
              radius: circleRadius(c.score, r.zoom, p.lat),
              fillColor: color,
              fillOpacity: 0.28,
              strokeWeight: 0,
              clickable: false,
            });
            circles.push({ circle, score: c.score, lat: p.lat });
          }
          const marker = new maps.Marker({
            map,
            position,
            title: t(p.name),
            icon: {
              content: `<div style="width:34px;height:34px;border-radius:9999px;background:#fff;border:3px solid ${color};display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 2px 6px rgba(0,0,0,.25);cursor:pointer">${p.emoji}</div>`,
              anchor: new maps.Point(17, 17),
            },
          });
          maps.Event.addListener(marker, "click", () => setSelected(p.id));
        }
        maps.Event.addListener(map, "zoom_changed", (zoom: number) => {
          for (const c of circles) c.circle.setRadius(circleRadius(c.score, zoom, c.lat));
        });
      })
      .catch((e) => {
        console.warn("[CrowdMap] 네이버 지도 초기화 실패, SVG 지도로 대체:", e);
        onFail();
      });

    return () => {
      cancelled = true;
      window.navermap_authFailure = undefined;
      // React가 지도 DOM을 먼저 떼어낸 뒤라 네이버 destroy()가 null 요소에서 예외를 던진다.
      // 정리 단계의 예외는 페이지 전체를 죽이므로 삼킨다
      try {
        mapRef.current?.destroy?.();
      } catch {}
      mapRef.current = null;
    };
    // 지도는 최초 1회만 생성
  }, []);

  const moveTo = (k: RegionKey) => {
    setRegion(k);
    setSelected(null);
    const map = mapRef.current;
    const maps = window.naver?.maps;
    if (!map || !maps) return;
    map.setCenter(new maps.LatLng(REGIONS[k].lat, REGIONS[k].lng));
    map.setZoom(REGIONS[k].zoom);
  };

  const sel = places.find((p) => p.id === selected);

  return (
    <div className="relative">
      <div className="absolute top-3 left-3 z-10 flex gap-0.5 rounded-full bg-white/95 p-1 shadow-md backdrop-blur">
        {(Object.keys(REGIONS) as RegionKey[]).map((k) => (
          <button
            key={k}
            onClick={() => moveTo(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold md:text-sm ${region === k ? "bg-gray-900 text-white" : "text-gray-600"}`}
          >
            {t(REGIONS[k].label)}
          </button>
        ))}
      </div>
      <div ref={el} className="h-[calc(100dvh-13rem)] min-h-[420px] w-full bg-slate-100" />
      {sel && <MapPlaceCard place={sel} crowd={crowd[sel.id]} />}
    </div>
  );
}
