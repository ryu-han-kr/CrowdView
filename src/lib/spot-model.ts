// 대표 명소(66곳) 혼잡 추정: 근처에 실시간 원천이 없는 명소도 장소와 같은 예측 모델(요일·시간·공휴일·날씨·관광공사 집중률)로
// 지금 혼잡과 시간대 곡선을 만든다. 화면에는 항상 '추정'으로 표시한다.
import spotKto from "@/data/korea/spot-kto.json";
import { forecastForDate, modelSnapshot } from "./crowd/model";
import { getSignals, type Signals } from "./crowd/signals";
import type { Landmark, LandmarkKind } from "./korea";
import { LANDMARK_INFO } from "./landmark-info";
import { closedToday, parseTodayHours } from "./place-info";
import { addDays, kst } from "./time";
import { lastYearVisitors, spotRegion } from "./region-visitors";
import type { CrowdSnapshot, HourPoint, Place } from "./types";

const SPOT_KTO = spotKto as Record<string, NonNullable<Place["kto"]>>;

// 종류별 기본값: 모델 분류 · 운영 시간(관광공사 글에서 못 읽을 때) · 인기도 · 가장 붐비는 시각 · 야외 정도
const KIND: Record<LandmarkKind, { category: Place["category"]; hours: [number, number]; popularity: number; peakHour: number; outdoor: number }> = {
  history: { category: "landmark", hours: [9, 18], popularity: 0.6, peakHour: 14, outdoor: 0.8 },
  nature: { category: "landmark", hours: [7, 19], popularity: 0.5, peakHour: 13, outdoor: 1 },
  city: { category: "street", hours: [10, 22], popularity: 0.6, peakHour: 16, outdoor: 0.5 },
  fun: { category: "themepark", hours: [10, 20], popularity: 0.6, peakHour: 14, outdoor: 0.7 },
  sea: { category: "beach", hours: [6, 22], popularity: 0.5, peakHour: 15, outdoor: 1 },
};

/** 명소를 예측 모델이 쓰는 장소 모양으로 (오늘 운영 시간·휴무는 관광공사 이용 안내에서) */
export function spotPlace(l: Landmark, date = kst().date): Place {
  const k = KIND[l.kind];
  const info = LANDMARK_INFO[l.id];
  const hours = (info?.usetime && parseTodayHours(info.usetime, date)) || k.hours;
  return {
    id: `spot-${l.id}`,
    name: l.n.ko,
    category: k.category,
    region: l.region,
    address: info?.addr ?? "",
    lat: l.lat,
    lng: l.lng,
    capacity: 10000,
    popularity: k.popularity,
    peakHour: k.peakHour,
    hours,
    emoji: "📍",
    hue: 220,
    tags: [],
    description: "",
    outdoor: k.outdoor,
    ...(SPOT_KTO[l.id] && { kto: SPOT_KTO[l.id] }),
    info: {
      hoursVerified: !!(info?.usetime && parseTodayHours(info.usetime, date)),
      closedToday: info?.restdate ? closedToday(info.restdate, date) : undefined,
    },
  };
}

export interface SpotForecast {
  place: Place;
  now: CrowdSnapshot;
  /** 오늘부터 7일, 운영 시간의 시간마다 예측 (주간 히트맵) */
  week: { date: string; points: HourPoint[]; closed: boolean }[];
  signals: Signals;
  /** 작년 같은 요일 그 시군구 방문객 (앞으로 7일, 데이터랩) */
  lastYear?: { region: string; days: { date: string; visitors: number }[] };
}

export async function spotForecast(l: Landmark): Promise<SpotForecast> {
  const place = spotPlace(l);
  const signals = await getSignals(place).catch(() => ({}) as Signals);
  // 시군구 방문객(작년 같은 요일, 앞으로 30일). 관광공사 집중률이 없는 명소는 이것으로 날마다 붐빔을 보정한다
  const region = spotRegion(l.id);
  const today0 = kst().date;
  const visitors = region
    ? await lastYearVisitors(
        region.code,
        Array.from({ length: 30 }, (_, i) => addDays(today0, i)),
        region.name,
      ).catch(() => new Map<string, number>())
    : new Map<string, number>();
  if (!signals.concentration?.size && visitors.size) signals.concentration = visitors;
  const now = modelSnapshot(place, new Date(), signals);
  const today = kst().date;
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const p = spotPlace(l, date);
    // 정기 휴무(매주 월요일 등)인 날은 칸을 비운다
    const rest = LANDMARK_INFO[l.id]?.restdate;
    const closed = !!rest && closedToday(rest, date);
    const points = closed ? [] : forecastForDate(p, date, signals).filter((x) => x.hour >= p.hours[0] && x.hour < Math.min(24, p.hours[1]));
    return { date, points, closed };
  });
  const lastYear = region && visitors.size
    ? { region: region.name, days: week.map((d) => ({ date: d.date, visitors: visitors.get(d.date) ?? 0 })).filter((d) => d.visitors > 0) }
    : undefined;
  return { place, now, week, signals, lastYear };
}
