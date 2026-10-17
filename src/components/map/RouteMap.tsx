"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { LatLng } from "@/lib/geo";
import { levelOf } from "@/lib/levels";
import { KEY_ID, loadSdk } from "@/lib/naver-map";

export interface RoutePoint extends LatLng {
  name: string;
  /** 예상 혼잡 점수 (출발지·식사는 없음) */
  score?: number;
  meal?: boolean;
}

const color = (p: RoutePoint) => (p.meal ? "#f59e0b" : p.score === undefined ? "#111827" : levelOf(p.score).color);

/**
 * 코스 지도: 네이버 지도에 출발지 → 들르는 곳 순서대로 점선과 번호 핀 (핀 색 = 그 시간 예상 혼잡 단계).
 * 지도 키가 없거나 불러오지 못하면 위치대로 찍은 간단한 그림
 */
export function RouteMap({ points }: { points: RoutePoint[] }) {
  const [failed, setFailed] = useState(!KEY_ID);
  return failed ? <RouteSketch points={points} /> : <NaverRoute points={points} onFail={() => setFailed(true)} />;
}

function NaverRoute({ points, onFail }: { points: RoutePoint[]; onFail: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const { lang, t } = useI18n();
  const key = JSON.stringify(points);

  useEffect(() => {
    let cancelled = false;
    let map: any;
    const overlays: any[] = [];
    window.navermap_authFailure = () => onFail();
    loadSdk(KEY_ID!, lang)
      .then(() => {
        if (cancelled || !el.current) return;
        const { maps } = window.naver;
        map = new maps.Map(el.current, {
          center: new maps.LatLng(points[0].lat, points[0].lng),
          zoom: 13,
          scaleControl: false,
          mapDataControl: false,
        });
        const path = points.map((p) => new maps.LatLng(p.lat, p.lng));
        overlays.push(new maps.Polyline({ map, path, strokeColor: "#6366f1", strokeWeight: 4, strokeStyle: "shortdash", strokeOpacity: 0.9 }));
        // 번호는 아래 목록과 같게 (식사도 한 칸)
        points.forEach((p, i) => {
          const label = i === 0 ? "S" : p.meal ? "🍽" : String(i);
          const size = i === 0 ? 26 : 32;
          const title = `${p.name}${p.score !== undefined && !p.meal ? ` · ${t(levelOf(p.score).label)}` : ""}`;
          overlays.push(
            new maps.Marker({
              map,
              position: path[i],
              title,
              icon: {
                content: `<div role="img" aria-label="${title.replace(/"/g, "&quot;")}" style="width:${size}px;height:${size}px;border-radius:9999px;background:${color(p)};color:#fff;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:700 13px system-ui;box-shadow:0 2px 6px rgba(0,0,0,.3)">${label}</div>`,
                anchor: new maps.Point(size / 2, size / 2),
              },
            }),
          );
        });
        if (points.length > 1) {
          const bounds = new maps.LatLngBounds(path[0], path[0]);
          for (const p of path) bounds.extend(p);
          map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
        }
      })
      .catch(() => onFail());
    return () => {
      cancelled = true;
      window.navermap_authFailure = undefined;
      for (const o of overlays) o.setMap(null);
      try {
        map?.destroy?.();
      } catch {}
    };
    // 부모가 다시 그려질 때마다 points 배열이 새로 만들어져도, 내용이 같으면 지도를 다시 만들지 않는다
    // (지도를 만들자마자 지우면 네이버 SDK 안쪽에서 예외가 나 페이지가 멈췄다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lang]);

  return <div ref={el} className="mt-4 h-72 w-full overflow-hidden rounded-3xl bg-sky-50 md:h-80" />;
}

/** 출발지와 들르는 곳을 위치대로 찍은 간단한 경로 그림 (핀 색 = 예상 혼잡) */
function RouteSketch({ points }: { points: RoutePoint[] }) {
  const W = 320;
  const H = 180;
  const pad = 24;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = Math.max(maxLat - minLat, (maxLng - minLng) * 0.8, 0.005);
  const x = (lng: number) => pad + ((lng - minLng) * 0.8 * (W - 2 * pad)) / span;
  const y = (lat: number) => H - pad - ((lat - minLat) * (H - 2 * pad)) / span;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-56 w-full rounded-3xl bg-sky-50 md:h-72" role="img" aria-label="route">
      <polyline
        points={points.map((p) => `${x(p.lng)},${y(p.lat)}`).join(" ")}
        fill="none"
        stroke="#6366f1"
        strokeWidth={2.5}
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.lng)} cy={y(p.lat)} r={i === 0 ? 7 : 11} fill={color(p)} stroke="white" strokeWidth={2} />
          {i > 0 && (
            <text x={x(p.lng)} y={y(p.lat) + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="white">
              {p.meal ? "·" : i}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
