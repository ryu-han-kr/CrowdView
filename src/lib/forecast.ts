// 서울시 12시간 예측이 없는 시간대(내일·주말)의 혼잡 예측 (서버 전용).
// 가까운 지하철역의 '요일 × 시간대' 승하차 모양(src/data/seoul/station-profile.json, 주 1회 갱신)을
// 지금 실시간·12시간 예측 점수에 맞춰 늘이거나 줄인다: 예측 = 비율 × 모양(요일, 시)
import profile from "@/data/seoul/station-profile.json";
import subway from "@/data/seoul/subway.json";
import { distanceKm, type LatLng } from "./geo";

interface Shape {
  /** 시간대 비중 24개 (‰) */
  h: number[];
  /** 요일 배수 7개 (%, 일~토) */
  d: number[];
}
const SHAPES = (profile as { s: Record<string, Shape> }).s;
const STATIONS = (subway as unknown as { s: [string, number, number][] }).s.filter(([name]) => SHAPES[name]);
const NEAR_KM = 1.2;

/** 가까운 역(1.2km 안, 최대 2곳)의 모양 평균. 역이 없으면 undefined */
export function shapeNear(p: LatLng): Shape | undefined {
  const near = STATIONS.map(([name, lat, lng]) => ({ name, km: distanceKm(p, { lat, lng }) }))
    .filter((x) => x.km <= NEAR_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, 2);
  if (!near.length) return undefined;
  const avg = (pick: (s: Shape) => number[]) =>
    pick(SHAPES[near[0].name]).map((_, i) => near.reduce((sum, x) => sum + pick(SHAPES[x.name])[i], 0) / near.length);
  return { h: avg((s) => s.h), d: avg((s) => s.d) };
}

/**
 * 그 시각의 상대 붐빔 (요일 배수 × 시간대 비중). absHour: 오늘 0시부터 센 시간, todayDow: 오늘 요일(0=일).
 * 시간대 비중은 한 달 치(평일이 대부분)라 출퇴근 꼭대기가 있다 → 주말엔 출근(6~9시)·퇴근(17~19시) 꼭대기를
 * 낮 시간대 수준으로 눌러 쓴다
 */
export function load(shape: Shape, absHour: number, todayDow: number): number {
  const dow = (todayDow + Math.floor(absHour / 24)) % 7;
  const hour = ((absHour % 24) + 24) % 24;
  let h = shape.h[hour];
  if (dow === 0 || dow === 6) {
    if (hour >= 6 && hour <= 9) h = Math.min(h, shape.h[11] * ((hour - 5) / 5));
    if (hour >= 17 && hour <= 19) h = Math.min(h, Math.max(shape.h[15], shape.h[16]));
  }
  return (shape.d[dow] / 100) * h;
}

/**
 * 알고 있는 점수들(실시간·12시간 예측)로 비율을 맞춘 예측 함수.
 * known: 절대 시 → 점수. 아는 점수가 없거나 모양의 값이 너무 작으면 undefined
 */
export function makePredictor(shape: Shape, known: Record<number, number>, todayDow: number): ((absHour: number) => number) | undefined {
  const pts = Object.entries(known)
    .map(([h, score]) => ({ p: load(shape, Number(h), todayDow), score }))
    .filter((x) => x.p > 5);
  if (!pts.length) return undefined;
  const k = pts.reduce((s, x) => s + x.score, 0) / pts.reduce((s, x) => s + x.p, 0);
  return (absHour) => Math.max(0, Math.min(100, Math.round(k * load(shape, absHour, todayDow))));
}
