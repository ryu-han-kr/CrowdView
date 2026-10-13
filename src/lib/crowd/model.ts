// 혼잡도 예측 모델 (베이스라인).
// 요일·시간대·장소 특성으로 기대 혼잡도를 계산한다. 실데이터가 쌓이면
// 과거 데이터·날씨 피처를 넣은 학습 모델로 교체할 자리.
import type { CrowdSnapshot, HourPoint, Place } from "../types";
import { kst, kstDateParts, type KstParts } from "../time";

const SPREAD: Record<Place["category"], number> = {
  themepark: 3.6,
  tourist: 3.2,
  airport: 4.5,
  event: 2.2,
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 시드 기반 -1 ~ 1 노이즈 */
function noise(seed: string): number {
  return (hash(seed) / 0xffffffff) * 2 - 1;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

function dayFactor(place: Place, t: KstParts): number {
  if (place.eventDate) {
    // 이벤트 당일엔 폭증, 그 외엔 평소 공원 수준
    return t.date === place.eventDate ? 1.15 : 0.3;
  }
  if (t.day === 0 || t.day === 6) return 1.2;
  if (t.day === 5 && t.hour >= 17) return 1.05;
  return 0.75;
}

/** 특정 시각의 기대 혼잡도 (노이즈 없음) */
export function expectedScore(place: Place, t: KstParts): number {
  const [open, close] = place.hours;
  if (t.hour < open || t.hour >= close) return 3;
  const d = t.hour - place.peakHour;
  const curve = 0.25 + 0.75 * Math.exp(-(d * d) / (2 * SPREAD[place.category] ** 2));
  return clamp(100 * place.popularity * curve * dayFactor(place, t));
}

/** 하루 시간대별 곡선. nowHour 이전은 관측값(노이즈 포함), 이후는 예측값 */
export function hourlyCurve(place: Place, date: KstParts, nowHour: number | null): HourPoint[] {
  const points: HourPoint[] = [];
  for (let h = 6; h <= 23; h++) {
    const t = { ...date, hour: h + 0.5 };
    const base = expectedScore(place, t);
    const forecast = nowHour === null || h > Math.floor(nowHour);
    const jitter = forecast ? 0 : noise(`${place.id}:${date.date}:${h}`) * 7;
    points.push({ hour: h, score: Math.round(clamp(base + jitter)), forecast });
  }
  return points;
}

export function forecastForDate(place: Place, date: string): HourPoint[] {
  return hourlyCurve(place, kstDateParts(date), null);
}

/** 외부 데이터가 없을 때 쓰는 시뮬레이션 스냅샷 */
export function modelSnapshot(place: Place, at: Date = new Date()): CrowdSnapshot {
  const now = kst(at);
  const bucket = Math.floor(at.getTime() / 600_000); // 10분 단위
  const score = Math.round(clamp(expectedScore(place, now) + noise(`${place.id}:${bucket}`) * 6));
  const before = expectedScore(place, { ...now, hour: now.hour - 0.5 });
  const delta = score - before;
  return {
    placeId: place.id,
    score,
    open: now.hour >= place.hours[0] && now.hour < place.hours[1],
    headcount: Math.round((place.capacity * score) / 100),
    trend: delta > 4 ? "up" : delta < -4 ? "down" : "flat",
    hourly: hourlyCurve(place, now, now.hour),
    source: "model",
    updatedAt: at.toISOString(),
  };
}
