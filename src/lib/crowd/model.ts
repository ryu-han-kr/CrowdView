// 혼잡도 예측 모델 (베이스라인 + 외부 신호 보정).
// 요일·시간대·장소 특성으로 기대 혼잡도를 계산하고, 신호가 있으면 곱셈 보정한다.
// - 공휴일·연휴 전날 (특일 정보)
// - 비·폭염·한파 × 장소의 야외 비율 (기상청 단기예보)
// - 관광지 집중률 30일 예측의 평소 대비 비율 (한국관광공사)
// - 공항은 시간대별 출발 승객 수가 있으면 그것으로 곡선을 대체 (공항공사)
// 실데이터가 쌓이면 과거 데이터를 학습한 모델로 교체할 자리.
import type { CrowdSnapshot, HourPoint, Place } from "../types";
import { addDays, kst, kstDateParts, type KstParts } from "../time";
import type { Signals, Weather } from "./signals";

const SPREAD: Record<Place["category"], number> = {
  themepark: 3.6,
  tourist: 3.2,
  airport: 4.5,
  event: 2.2,
};

const OUTDOOR: Record<Place["category"], number> = {
  themepark: 0.7,
  tourist: 0.8,
  airport: 0,
  event: 1,
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
const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0");

function dayFactor(place: Place, t: KstParts, s?: Signals): number {
  if (place.eventDate) {
    // 이벤트 당일엔 폭증, 그 외엔 평소 공원 수준
    return t.date === place.eventDate ? 1.15 : 0.3;
  }
  if (s?.holidays?.has(t.date)) return 1.25;
  if (t.day === 0 || t.day === 6) return 1.2;
  // 공휴일 전날 저녁·금요일 저녁은 조금 붐빈다
  if (t.hour >= 17 && (t.day === 5 || s?.holidays?.has(addDays(t.date, 1)))) return 1.05;
  return 0.75;
}

function weatherAt(s: Signals | undefined, t: KstParts): Weather | undefined {
  return s?.weather?.get(`${t.date} ${pad2(t.hour)}`);
}

function weatherFactor(place: Place, t: KstParts, s?: Signals): number {
  const w = weatherAt(s, t);
  if (!w) return 1;
  const outdoor = place.outdoor ?? OUTDOOR[place.category];
  let f = 1;
  // 비가 오면 야외는 한산해지고, 실내 위주 장소는 사람이 몰린다
  if ((w.pty ?? 0) > 0) f *= 1 - 0.5 * outdoor + 0.2 * (1 - outdoor);
  else if ((w.pop ?? 0) >= 60) f *= 1 - 0.25 * outdoor;
  if (w.tmp !== undefined && (w.tmp >= 33 || w.tmp <= -8)) f *= 1 - 0.2 * outdoor;
  return f;
}

/** 관광지 집중률 예측값이 30일 평균보다 얼마나 높은지 (0.7 ~ 1.4) */
function concentrationRatio(s: Signals | undefined, date: string): number | undefined {
  const rates = s?.concentration;
  const rate = rates?.get(date);
  if (!rates || rate === undefined || rates.size === 0) return undefined;
  const mean = [...rates.values()].reduce((a, b) => a + b, 0) / rates.size;
  return mean > 0 ? rate / mean : undefined;
}

function concentrationFactor(s: Signals | undefined, date: string): number {
  const ratio = concentrationRatio(s, date);
  return ratio === undefined ? 1 : Math.max(0.7, Math.min(1.4, 0.5 + 0.5 * ratio));
}

/** 특정 시각의 기대 혼잡도 (노이즈 없음) */
export function expectedScore(place: Place, t: KstParts, s?: Signals): number {
  const [open, close] = place.hours;
  if (t.hour < open || t.hour >= close) return 3;
  const pax = s?.pax?.get(t.date)?.[Math.floor(t.hour)];
  if (pax !== undefined && place.paxCapacity) return clamp((90 * pax) / place.paxCapacity);
  const d = t.hour - place.peakHour;
  const curve = 0.25 + 0.75 * Math.exp(-(d * d) / (2 * SPREAD[place.category] ** 2));
  return clamp(
    100 * place.popularity * curve * dayFactor(place, t, s) * weatherFactor(place, t, s) * concentrationFactor(s, t.date),
  );
}

/** 하루 시간대별 곡선. nowHour 이전은 관측값(노이즈 포함), 이후는 예측값 */
export function hourlyCurve(place: Place, date: KstParts, nowHour: number | null, s?: Signals): HourPoint[] {
  const points: HourPoint[] = [];
  for (let h = 6; h <= 23; h++) {
    const t = { ...date, hour: h + 0.5 };
    const base = expectedScore(place, t, s);
    const forecast = nowHour === null || h > Math.floor(nowHour);
    const jitter = forecast ? 0 : noise(`${place.id}:${date.date}:${h}`) * 7;
    points.push({ hour: h, score: Math.round(clamp(base + jitter)), forecast });
  }
  return points;
}

export function forecastForDate(place: Place, date: string, s?: Signals): HourPoint[] {
  return hourlyCurve(place, kstDateParts(date), null, s);
}

/** 그날 예측이 평소와 다른 이유 (화면 표시용) */
export function forecastReasons(place: Place, date: string, peakHour: number, s?: Signals): string[] {
  const reasons: string[] = [];
  const holiday = s?.holidays?.get(date);
  if (holiday) reasons.push(`🎌 ${holiday}`);
  else if (s?.holidays?.has(addDays(date, 1))) reasons.push("🧳 연휴 전날");
  const w = weatherAt(s, { ...kstDateParts(date), hour: peakHour });
  const outdoor = place.outdoor ?? OUTDOOR[place.category];
  if (w && outdoor > 0) {
    if ((w.pty ?? 0) > 0) reasons.push(outdoor >= 0.5 ? "🌧 비 예보 → 한산" : "🌧 비 예보 → 실내로 몰림");
    else if ((w.pop ?? 0) >= 60) reasons.push(`☔ 강수확률 ${w.pop}%`);
    if (w.tmp !== undefined && w.tmp >= 33) reasons.push(`🥵 ${w.tmp}°C 폭염`);
    if (w.tmp !== undefined && w.tmp <= -8) reasons.push(`🥶 ${w.tmp}°C 한파`);
  }
  const ratio = concentrationRatio(s, date);
  if (ratio !== undefined && ratio >= 1.2) reasons.push("📈 관광공사 예측: 평소보다 붐빔");
  if (ratio !== undefined && ratio <= 0.8) reasons.push("📉 관광공사 예측: 평소보다 한산");
  if (s?.pax?.has(date) && place.paxCapacity) reasons.push("✈️ 공항공사 시간대별 승객 수 반영");
  return reasons;
}

export interface DayForecast {
  date: string;
  peakScore: number;
  peakHour: number;
  reasons: string[];
}

/** 오늘부터 n일간 하루 최대 혼잡도 */
export function weekForecast(place: Place, s?: Signals, days = 7, from = kst().date): DayForecast[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    // 점수가 100에 붙어 여러 시간이 같으면 평소 피크 시각에 가까운 쪽을 고른다
    const near = (h: number) => Math.abs(h + 0.5 - place.peakHour);
    const peak = forecastForDate(place, date, s).reduce((a, b) =>
      b.score > a.score || (b.score === a.score && near(b.hour) < near(a.hour)) ? b : a,
    );
    return { date, peakScore: peak.score, peakHour: peak.hour, reasons: forecastReasons(place, date, peak.hour + 0.5, s) };
  });
}

/** 외부 데이터가 없을 때 쓰는 시뮬레이션 스냅샷 */
export function modelSnapshot(place: Place, at: Date = new Date(), s?: Signals): CrowdSnapshot {
  const now = kst(at);
  const bucket = Math.floor(at.getTime() / 600_000); // 10분 단위
  const score = Math.round(clamp(expectedScore(place, now, s) + noise(`${place.id}:${bucket}`) * 6));
  const before = expectedScore(place, { ...now, hour: now.hour - 0.5 }, s);
  const delta = score - before;
  return {
    placeId: place.id,
    score,
    open: now.hour >= place.hours[0] && now.hour < place.hours[1],
    headcount: Math.round((place.capacity * score) / 100),
    trend: delta > 4 ? "up" : delta < -4 ? "down" : "flat",
    hourly: hourlyCurve(place, now, now.hour, s),
    source: "model",
    updatedAt: at.toISOString(),
  };
}
