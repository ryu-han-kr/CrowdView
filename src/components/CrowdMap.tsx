"use client";

// 네이버 지도 위에 혼잡도 원과 장소 핀을 그린다.
// 키가 없거나 인증·로딩에 실패하면 자체 SVG 히트맵으로 대체.
import { useEffect, useRef, useState } from "react";
import { levelOf } from "@/lib/levels";
import type { CrowdResult, Place } from "@/lib/types";
import { HeatMap, MapPlaceCard } from "./HeatMap";

declare global {
  interface Window {
    naver?: any;
    navermap_authFailure?: () => void;
  }
}

const KEY_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const SCRIPT_ID = "naver-maps-sdk";

const REGIONS = {
  capital: { label: "수도권", lat: 37.47, lng: 127.03, zoom: 10 },
  busan: { label: "부산", lat: 35.156, lng: 129.14, zoom: 13 },
} as const;
type RegionKey = keyof typeof REGIONS;

function loadSdk(keyId: string): Promise<void> {
  if (window.naver?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${keyId}`;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("naver maps sdk load failed")));
  });
}

export function CrowdMap({ places, crowd }: { places: Place[]; crowd: Record<string, CrowdResult> }) {
  const [failed, setFailed] = useState(!KEY_ID);
  if (failed) return <HeatMap places={places} crowd={crowd} />;
  return <NaverCrowdMap places={places} crowd={crowd} onFail={() => setFailed(true)} />;
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

  useEffect(() => {
    let cancelled = false;
    // 네이버 지도는 인증 실패 시 이 전역 콜백을 호출한다
    window.navermap_authFailure = () => {
      console.warn("[CrowdMap] 네이버 지도 인증 실패 — 서비스 URL 등록 여부를 확인하세요.");
      onFail();
    };

    loadSdk(KEY_ID!)
      .then(() => {
        if (cancelled || !el.current) return;
        const { maps } = window.naver;
        const r = REGIONS.capital;
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
            // 부산은 확대 수준이 높아 반경을 줄인다
            const scale = p.lat < 36 ? 6 : 25;
            new maps.Circle({
              map,
              center: position,
              radius: (20 + c.score) * scale,
              fillColor: color,
              fillOpacity: 0.3,
              strokeWeight: 0,
              clickable: false,
            });
          }
          const marker = new maps.Marker({
            map,
            position,
            title: p.name,
            icon: {
              content: `<div style="width:32px;height:32px;border-radius:9999px;background:#fff;border:3px solid ${color};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 1px 4px rgba(0,0,0,.2)">${p.emoji}</div>`,
              anchor: new maps.Point(16, 16),
            },
          });
          maps.Event.addListener(marker, "click", () => setSelected(p.id));
        }
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
      <div className="absolute top-3 left-3 z-10 flex gap-1 rounded-full bg-white/90 p-1 shadow-sm backdrop-blur">
        {(Object.keys(REGIONS) as RegionKey[]).map((k) => (
          <button
            key={k}
            onClick={() => moveTo(k)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${region === k ? "bg-gray-900 text-white" : "text-gray-600"}`}
          >
            {REGIONS[k].label}
          </button>
        ))}
      </div>
      <div ref={el} className="h-[480px] w-full bg-slate-100" />
      {sel && <MapPlaceCard place={sel} crowd={crowd[sel.id]} />}
    </div>
  );
}
