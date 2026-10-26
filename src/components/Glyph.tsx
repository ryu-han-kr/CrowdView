// 이모지 아이콘 → Lucide 선 아이콘. 기기마다 모양이 다른 이모지 대신 굵기·크기가 통일된 아이콘으로 그린다.
// 데이터(장소·축제·분류)는 이모지를 그대로 갖고 있고, 화면에 그릴 때만 이 표로 바꾼다 (표에 없으면 이모지 그대로)
import {
  Bike,
  Check,
  Flower2,
  Guitar,
  Heart,
  Landmark,
  Mountain,
  MountainSnow,
  PlaneLanding,
  PlaneTakeoff,
  Soup,
  Star,
  Tent,
  Toilet,
  TowerControl,
  TrainFront,
  TreePalm,
  TreePine,
  Utensils,
  Waves,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { SolarIcon } from "@/components/icons/SolarIcon";
import type { SolarName } from "@/components/icons/solar";

/** 이모지 → Solar 아이콘 이름(채운 모양, 사용자 10/26) 또는 Solar에 없는 것은 [Lucide 아이콘, 채움 여부] */
const MAP: Record<string, SolarName | [LucideIcon, boolean?]> = {
  "🏯": [Landmark],
  "🏛️": [Landmark],
  "🏛": [Landmark],
  "🗼": [TowerControl],
  "🌿": "leaf",
  "🌳": [TreePine],
  "🏞️": [Mountain],
  "⛷️": [MountainSnow],
  "🏙️": "buildings-2",
  "🎢": "ferris-wheel",
  "🎡": "ferris-wheel",
  "🎠": "ferris-wheel",
  "🌊": [Waves],
  "🏖️": [TreePalm],
  "☕": "cup-hot",
  "🎸": [Guitar],
  "🎵": "music-note",
  "✈️": "plane",
  "✈": "plane",
  "🛫": [PlaneTakeoff],
  "🛬": [PlaneLanding],
  "🛩️": "plane",
  "🛂": "shield-check",
  "🎆": "confetti",
  "🎇": "confetti",
  "✨": "stars",
  "🏮": "lamp",
  "🌸": [Flower2],
  "🍜": [Soup],
  "🍽️": [Utensils],
  "🍽": [Utensils],
  "🖼️": "gallery",
  "🎪": [Tent],
  "🎨": "palette",
  "🎟️": "ticket",
  "📍": "map-point",
  "🏷️": "tag",
  "🗺️": "map",
  "🗾": "map",
  "📖": "book-2",
  "🧭": "compass",
  "🚻": [Toilet],
  "🚇": [TrainFront],
  "🚶": "walking",
  "🚗": "car",
  "🚲": [Bike],
  "🚴": [Bike],
  "💳": "card",
  "🛍️": "bag-4",
  "📶": [Wifi],
  "📡": "radio",
  "🔔": "bell",
  "🔥": "fire",
  "🔒": "lock",
  "🔗": "link",
  "💾": "bookmark",
  "📅": "calendar",
  "🕒": "clock-circle",
  "⚠️": "danger-triangle",
  "⚙️": "settings",
  "🌐": "globe",
  "👤": "user",
  "🎯": "target",
  "🚫": "forbidden-circle",
  "🛏️": "bed",
  "🧳": "suitcase",
  "📈": "graph-up",
  "📉": "graph-down",
  "☰": "hamburger-menu",
  "☀️": "sun",
  "🌙": "moon",
  "⛅": "cloud-sun",
  "☁️": "cloud",
  "🌧️": "cloud-rain",
  "🌧": "cloud-rain",
  "🌨️": "cloud-snowfall",
  "☔": "umbrella",
  "🌡️": "thermometer",
  "😷": "facemask-circle",
  "☆": [Star],
  "⭐": "star",
  "★": "star",
  "🤍": [Heart],
  "❤️": "heart",
  "✕": [X],
  "✓": [Check],
};

/** 이모지 문자에 맞는 Lucide 아이콘 (없으면 undefined) */
export const glyphOf = (e: string | undefined) => (e ? MAP[e] : undefined);

/**
 * 이모지 대신 아이콘. 크기는 글자 크기를 따른다(1em) — 주변 글씨와 같은 줄에 자연스럽게 놓인다.
 * className으로 크기·색을 바꿀 수 있다 (예: "h-6 w-6 text-indigo-600")
 */
export function Glyph({ e, className = "", label }: { e: string | undefined; className?: string; label?: string }) {
  if (!e) return null;
  const hit = MAP[e];
  if (!hit)
    return (
      <span aria-hidden={!label} aria-label={label}>
        {e}
      </span>
    );
  if (typeof hit === "string") return <SolarIcon name={hit} className={className || "h-[1em] w-[1em]"} label={label} />;
  const [Icon, filled] = hit;
  return (
    <Icon
      aria-hidden={!label}
      aria-label={label}
      strokeWidth={1.9}
      className={`inline-block shrink-0 align-[-0.125em] ${className || "h-[1em] w-[1em]"}`}
      fill={filled ? "currentColor" : "none"}
    />
  );
}
