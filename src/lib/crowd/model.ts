// 혼잡도 예측 모델 (베이스라인 + 외부 신호 보정).
// 요일·시간대·장소 특성으로 기대 혼잡도를 계산하고, 신호가 있으면 곱셈 보정한다.
// - 공휴일·연휴 전날 (특일 정보)
// - 비·폭염·한파 × 장소의 야외 비율 (기상청 단기예보)
// - 관광지 집중률 30일 예측의 평소 대비 비율 (한국관광공사)
// - 공항은 시간대별 출발 승객 수가 있으면 그것으로 곡선을 대체 (공항공사)
// 실데이터가 쌓이면 과거 데이터를 학습한 모델로 교체할 자리.
import { scoreFromValue, valueFromScore } from "../levels";
import type { CrowdSnapshot, HourPoint, Place } from "../types";
import { addDays, kst, kstDateParts, type KstParts } from "../time";
import type { Signals, Weather } from "./signals";

const SPREAD: Record<Place["category"], number> = {
  landmark: 3.2,
  street: 3.6,
  themepark: 3.6,
  waterpark: 3.2,
  ski: 3.4,
  beach: 3.4,
  airport: 4.5,
  event: 2.2,
};

/** 카테고리별 기본 야외 비율 (장소에 outdoor가 없을 때) */
export const OUTDOOR: Record<Place["category"], number> = {
  landmark: 0.8,
  street: 0.5,
  themepark: 0.7,
  waterpark: 0.6,
  ski: 1,
  beach: 1,
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

/** 계절 영업 장소가 그 날짜(YYYY-MM-DD)에 시즌인지 */
export function inSeason(place: Place, date: string): boolean {
  if (!place.season) return true;
  const m = Number(date.slice(5, 7));
  const [from, to] = place.season;
  return from <= to ? m >= from && m <= to : m >= from || m <= to;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0");

function dayFactor(place: Place, t: KstParts, s?: Signals): number {
  if (place.eventDate) {
    // 이벤트 당일엔 폭증, 그 외엔 평소 공원 수준
    return t.date >= place.eventDate && t.date <= (place.eventEndDate ?? place.eventDate) ? 1.15 : 0.3;
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

/** 단기예보가 없는 4~10일 뒤는 중기예보(오전·오후 강수확률, 날씨)로 대신한다 */
function midAt(s: Signals | undefined, t: KstParts): { pop: number; rainy: boolean; wf: string } | undefined {
  const m = s?.midWeather?.get(t.date);
  if (!m) return undefined;
  const am = t.hour < 12;
  const wf = am ? m.wfAm : m.wfPm;
  return { pop: am ? m.popAm : m.popPm, rainy: /비|눈|소나기/.test(wf), wf };
}

function weatherFactor(place: Place, t: KstParts, s?: Signals): number {
  const outdoor = place.outdoor ?? OUTDOOR[place.category];
  const w = weatherAt(s, t);
  if (!w) {
    const m = midAt(s, t);
    if (!m) return 1;
    if (m.rainy && m.pop >= 60) return 1 - 0.4 * outdoor + 0.15 * (1 - outdoor);
    return m.pop >= 60 ? 1 - 0.2 * outdoor : 1;
  }
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

/** 초미세먼지 등급(1 좋음 ~ 4 매우나쁨). 오늘은 실시간 측정, 이후는 예보 */
function airGrade(s: Signals | undefined, date: string): number | undefined {
  if (date === kst().date && s?.air?.pm25Grade) return s.air.pm25Grade;
  return s?.airForecast?.get(date);
}

function airFactor(place: Place, date: string, s?: Signals): number {
  const outdoor = place.outdoor ?? OUTDOOR[place.category];
  const g = airGrade(s, date);
  return g === 4 ? 1 - 0.25 * outdoor : g === 3 ? 1 - 0.12 * outdoor : 1;
}

/** 네이버 검색 추이: 오늘부터 7일 동안만 (그 뒤는 알 수 없다) */
function trendFactor(s: Signals | undefined, date: string): number {
  if (!s?.searchTrend) return 1;
  const today = kst().date;
  return date >= today && date <= addDays(today, 6) ? s.searchTrend : 1;
}

/** 학교 쉬는 날(방학·재량휴업)의 평일: 가족 나들이 장소가 붐빈다 (주말·공휴일은 이미 dayFactor에) */
const FAMILY: Partial<Record<Place["category"], number>> = { themepark: 0.35, waterpark: 0.35, ski: 0.3, landmark: 0.15 };
function schoolFactor(place: Place, t: KstParts, s?: Signals): number {
  const share = s?.schoolOff?.get(t.date);
  const weight = FAMILY[place.category];
  if (!share || !weight || t.day === 0 || t.day === 6 || s?.holidays?.has(t.date)) return 1;
  return 1 + weight * share;
}

function concentrationFactor(s: Signals | undefined, date: string): number {
  const ratio = concentrationRatio(s, date);
  return ratio === undefined ? 1 : Math.max(0.7, Math.min(1.4, 0.5 + 0.5 * ratio));
}

interface Expected {
  score: number;
  people?: number;
  peopleKind?: HourPoint["peopleKind"];
}

/** 특정 시각의 기대 혼잡도와 인원 (노이즈 없음) */
function expected(place: Place, t: KstParts, s?: Signals): Expected {
  const [open, close] = place.hours;
  if (t.hour < open || t.hour >= close || !inSeason(place, t.date)) return { score: 3 };
  if (place.info?.closedToday && t.date === kst().date) return { score: 3 };
  const h = Math.floor(t.hour);

  // 공항: 공항공사가 예고한 시간대별 출발 승객 수를 장소별 기준으로 점수화
  const pax = s?.pax?.get(t.date)?.[h];
  if (pax !== undefined && place.paxSteps) return { score: scoreFromValue(pax, place.paxSteps), people: pax, peopleKind: "real" };

  const factors =
    dayFactor(place, t, s) *
    weatherFactor(place, t, s) *
    airFactor(place, t.date, s) *
    concentrationFactor(s, t.date) *
    trendFactor(s, t.date) *
    schoolFactor(place, t, s);
  const pop = s?.localPop?.hourly;
  const eventDay = !!place.eventDate && t.date >= place.eventDate && t.date <= (place.eventEndDate ?? place.eventDate);

  // 부산시 생활인구: 같은 달 평균 방문인구 × 요일·날씨 보정 = 그 시간 예상 인원 → 장소 기준으로 단계
  if (pop?.[h] && place.criteria?.unit === "명" && !eventDay) {
    // 요일 보정 평균(약 0.9)을 1로 맞춘다
    const people = Math.round((pop[h] * factors) / 0.9);
    return { score: scoreFromValue(people, place.criteria.steps), people, peopleKind: "pattern" };
  }

  const d = t.hour - place.peakHour;
  const curve = 0.25 + 0.75 * Math.exp(-(d * d) / (2 * SPREAD[place.category] ** 2));
  const score = clamp(100 * place.popularity * curve * factors);
  return place.criteria?.unit === "명" ? { score, people: valueFromScore(score, place.criteria.steps), peopleKind: "est" } : { score };
}

export function expectedScore(place: Place, t: KstParts, s?: Signals): number {
  return expected(place, t, s).score;
}

/** 하루 시간대별 곡선. nowHour 이전은 관측값(노이즈 포함), 이후는 예측값 */
export function hourlyCurve(place: Place, date: KstParts, nowHour: number | null, s?: Signals): HourPoint[] {
  const points: HourPoint[] = [];
  for (let h = 6; h <= 23; h++) {
    const e = expected(place, { ...date, hour: h + 0.5 }, s);
    const forecast = nowHour === null || h > Math.floor(nowHour);
    // 추정 곡선의 지난 시간만 약간 흔들어 실측처럼 보이게 하던 노이즈 (실제 수치가 있으면 쓰지 않음)
    const jitter = forecast || e.peopleKind !== "est" ? 0 : noise(`${place.id}:${date.date}:${h}`) * 7;
    const score = Math.round(clamp(e.score + jitter));
    const people = e.peopleKind === "est" && place.criteria ? valueFromScore(score, place.criteria.steps) : e.people;
    points.push({ hour: h, score, forecast, ...(people !== undefined ? { people, peopleKind: e.peopleKind } : {}) });
  }
  return points;
}

export function forecastForDate(place: Place, date: string, s?: Signals): HourPoint[] {
  return hourlyCurve(place, kstDateParts(date), null, s);
}

/** 그날 예측이 평소와 다른 이유 (화면 표시용) */
/** 예측 이유: 번역 키(한국어 템플릿)와 값. 화면에서 t(k, p)로 보여준다 */
export interface Reason {
  k: string;
  p?: Record<string, string | number>;
}

export function forecastReasons(place: Place, date: string, peakHour: number, s?: Signals): Reason[] {
  const reasons: Reason[] = [];
  const holiday = s?.holidays?.get(date);
  if (holiday) reasons.push({ k: "🎌 {name}", p: { name: holiday } });
  else if (s?.holidays?.has(addDays(date, 1))) reasons.push({ k: "🧳 연휴 전날" });
  const w = weatherAt(s, { ...kstDateParts(date), hour: peakHour });
  const outdoor = place.outdoor ?? OUTDOOR[place.category];
  if (w && outdoor > 0) {
    if ((w.pty ?? 0) > 0) reasons.push({ k: outdoor >= 0.5 ? "🌧 비 예보 → 한산" : "🌧 비 예보 → 실내로 몰림" });
    else if ((w.pop ?? 0) >= 60) reasons.push({ k: "☔ 강수확률 {pop}%", p: { pop: w.pop! } });
    if (w.tmp !== undefined && w.tmp >= 33) reasons.push({ k: "🥵 {tmp}°C 폭염", p: { tmp: w.tmp } });
    if (w.tmp !== undefined && w.tmp <= -8) reasons.push({ k: "🥶 {tmp}°C 한파", p: { tmp: w.tmp } });
  } else if (outdoor > 0) {
    const m = midAt(s, { ...kstDateParts(date), hour: peakHour });
    if (m?.rainy && m.pop >= 60) reasons.push({ k: outdoor >= 0.5 ? "🌧 {wf} 예보 → 한산" : "🌧 {wf} 예보 → 실내로 몰림", p: { wf: m.wf } });
    else if (m && m.pop >= 60) reasons.push({ k: "☔ 강수확률 {pop}%", p: { pop: m.pop } });
  }
  const ag = airGrade(s, date);
  if (outdoor > 0 && ag && ag >= 3) reasons.push({ k: ag === 4 ? "😷 초미세먼지 매우나쁨 → 야외 한산" : "😷 초미세먼지 나쁨" });
  const ratio = concentrationRatio(s, date);
  if (ratio !== undefined && ratio >= 1.2) reasons.push({ k: "📈 관광공사 예측: 평소보다 붐빔" });
  if (ratio !== undefined && ratio <= 0.8) reasons.push({ k: "📉 관광공사 예측: 평소보다 한산" });
  if (s?.pax?.has(date) && place.paxSteps) reasons.push({ k: "✈️ 공항공사 시간대별 승객 수 반영" });
  return reasons;
}

export interface DayForecast {
  date: string;
  peakScore: number;
  peakHour: number;
  reasons: Reason[];
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
    open: now.hour >= place.hours[0] && now.hour < place.hours[1] && !place.info?.closedToday && inSeason(place, now.date),
    ...(inSeason(place, now.date) ? {} : { offSeason: true }),
    // 인원 기준이 있으면 같은 기준으로 환산 (그래프·카드 숫자가 서로 맞도록)
    headcount: place.criteria?.unit === "명" ? valueFromScore(score, place.criteria.steps) : Math.round((place.capacity * score) / 100),
    trend: delta > 4 ? "up" : delta < -4 ? "down" : "flat",
    hourly: hourlyCurve(place, now, now.hour, s),
    source: "model",
    updatedAt: at.toISOString(),
  };
}
