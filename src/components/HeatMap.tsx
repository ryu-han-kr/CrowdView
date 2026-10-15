"use client";

// 혼잡도 히트맵. 지금은 자체 SVG 좌표 투영으로 그리고,
// NEXT_PUBLIC_KAKAO_MAP_KEY 연동 시 카카오맵 위 오버레이로 교체 예정.
import Link from "@/i18n/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { LEVELS, levelOf } from "@/lib/levels";
import type { CrowdResult, Place } from "@/lib/types";
import { LevelBadge } from "./Level";
import { PlaceThumb } from "./PlaceRow";
import { placeHref } from "@/lib/places";
import { headcountInfo, isEstimated } from "@/lib/format";
import { DataTag } from "./DataTag";

const W = 400;
const H = 480;

const REGIONS = {
  capital: { label: "수도권", lat: [37.26, 37.62], lng: [126.86, 127.26] },
  busan: { label: "부산", lat: [35.12, 35.19], lng: [129.08, 129.2] },
} as const;
type RegionKey = keyof typeof REGIONS;

const HAN_RIVER: [number, number][] = [
  [126.86, 37.585], [126.9, 37.555], [126.935, 37.53], [126.97, 37.515], [127.0, 37.515],
  [127.03, 37.525], [127.07, 37.53], [127.1, 37.525], [127.13, 37.545], [127.18, 37.56], [127.26, 37.58],
];

export function HeatMap({ places, crowd }: { places: Place[]; crowd: Record<string, CrowdResult> }) {
  const { t } = useI18n();
  const [region, setRegion] = useState<RegionKey>("capital");
  const [selected, setSelected] = useState<string | null>(null);
  const r = REGIONS[region];

  const project = (lat: number, lng: number) => ({
    x: ((lng - r.lng[0]) / (r.lng[1] - r.lng[0])) * W,
    y: ((r.lat[1] - lat) / (r.lat[1] - r.lat[0])) * H,
  });

  const visible = places.filter(
    (p) => p.lat >= r.lat[0] && p.lat <= r.lat[1] && p.lng >= r.lng[0] && p.lng <= r.lng[1],
  );
  const sel = visible.find((p) => p.id === selected);

  return (
    <div className="relative">
      <div className="absolute top-3 left-3 z-10 flex gap-1 rounded-full bg-white/90 p-1 shadow-sm backdrop-blur">
        {(Object.keys(REGIONS) as RegionKey[]).map((k) => (
          <button
            key={k}
            onClick={() => {
              setRegion(k);
              setSelected(null);
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${region === k ? "bg-gray-900 text-white" : "text-gray-600"}`}
          >
            {t(REGIONS[k].label)}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full bg-slate-50" onClick={() => setSelected(null)}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
          </pattern>
          {LEVELS.map((l) => (
            <radialGradient key={l.key} id={`heat-${l.key}`}>
              <stop offset="0%" stopColor={l.color} stopOpacity="0.75" />
              <stop offset="60%" stopColor={l.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={l.color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {region === "capital" && (
          <polyline
            points={HAN_RIVER.map(([lng, lat]) => {
              const { x, y } = project(lat, lng);
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke="#bfdbfe"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {region === "busan" && <rect x="0" y={H * 0.72} width={W} height={H * 0.28} fill="#dbeafe" />}

        {visible.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          const c = crowd[p.id];
          if (!c.open) return null;
          const radius = 28 + c.score * 0.9;
          return (
            <circle key={`h-${p.id}`} cx={x} cy={y} r={radius} fill={`url(#heat-${levelOf(c.score).key})`} />
          );
        })}
        {visible.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          const active = p.id === selected;
          return (
            <g
              key={p.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSelected(p.id);
              }}
            >
              <circle
                cx={x}
                cy={y}
                r={active ? 18 : 15}
                fill="white"
                stroke={crowd[p.id].open ? levelOf(crowd[p.id].score).color : "#cbd5e1"}
                strokeWidth="3"
              />
              <text x={x} y={y + 6} textAnchor="middle" fontSize="16">
                {p.emoji}
              </text>
              <text x={x} y={y + 32} textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155" stroke="white" strokeWidth="3" paintOrder="stroke">
                {t(p.name)}
              </text>
            </g>
          );
        })}
      </svg>

      {sel && <MapPlaceCard place={sel} crowd={crowd[sel.id]} />}
    </div>
  );
}

/** 지도에서 핀을 눌렀을 때 하단에 뜨는 장소 카드 */
export function MapPlaceCard({ place, crowd }: { place: Place; crowd: CrowdResult }) {
  const { t, lang } = useI18n();
  const hc = headcountInfo(crowd, { t, lang });
  return (
    <Link
      href={placeHref(place)}
      className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-3 rounded-3xl bg-white p-3.5 shadow-xl active:scale-[0.99]"
    >
      <PlaceThumb place={place} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{t(place.name)}</p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {t(place.region)}
          {hc && (
            <>
              {" · "}
              {hc.text}
              {hc.kind && <DataTag kind={hc.kind} />}
            </>
          )}
        </p>
        <div className="mt-1.5">
          <LevelBadge score={crowd.score} closed={!crowd.open} />
          {crowd.open && isEstimated(crowd) && <DataTag />}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white">{t("자세히")}</span>
    </Link>
  );
}
