// 구글 지도(Places API New) 장소 정보: 평점·리뷰 수(늘어나는 속도)·요일별 운영 시간·특별 운영일·영업 상태.
// - 운영 시간: TourAPI에서 오늘 운영 시간을 못 찾은 곳은 구글 값으로 (lib/place-info)
// - 인기도: 실측 원천이 없는 곳은 같은 카테고리 안 리뷰 수·증가 속도 백분위로 손으로 정한 popularity를 조금 당긴다
// - 화면: 장소 페이지에 평점·리뷰 수 + 'Google 지도' 링크 (구글 표기 규정)
// - 폐업·임시 휴업은 운영 알림만 (장소는 빼지 않는다)
// 비용: 구글 place id 찾기는 Text Search 'IDs only'(field mask places.id, 무료·무제한), 상세는 Place Details Enterprise(월 1,000건 무료).
// 약관: place id는 계속 보관 가능, 나머지는 30일 안에 다시 받는다 → 10일마다 갱신, 이달 900건(api-quota google-details 90%)에서 멈춘다
import { kv } from "./cache";
import { APIS, beforeCall, countCall, QuotaError } from "./api-quota";
import { distanceKm } from "./geo";
import { opsAlert } from "./ops";
import { GOOGLE_PHOTO } from "./places-google";
import { PARKING_LOTS } from "./crowd/parking";
import { inSeason } from "./crowd/model";
import { kst } from "./time";
import type { Category, Place } from "./types";

export type Hours = [open: number, close: number];

export interface GoogleFacts {
  /** 구글 place id (못 찾았으면 없음) */
  gid?: string;
  /** 구글 표기 이름 (맞게 찾았는지 확인용) */
  name?: string;
  rating?: number;
  count?: number;
  /** [YYYY-MM-DD, 리뷰 수] 받을 때마다 (최근 HIST_MAX개) → 늘어나는 속도 */
  hist?: [string, number][];
  /** 요일별 운영 시간 (KST, 0=일 … 6=토). null 휴무. 밤샘은 닫는 시각이 24를 넘는다 */
  week?: (Hours | null)[];
  /** 앞으로 7일 안의 특별 운영일 (공휴일 등). null 휴무 */
  special?: Record<string, Hours | null>;
  status?: string;
  uri?: string;
  /** 구글 지도 소개 한 줄 (editorialSummary) */
  summary?: string;
  phone?: string;
  web?: string;
  /** 편의 정보 중 '있음'인 것 (AMENITY_LABEL 키: 주차·휠체어·아이 동반·화장실·반려견) */
  amen?: string[];
  /** 받은 시각 (ISO) */
  at: string;
  /** 못 찾았거나(검색 결과 없음) 너무 멀리 있는 곳이 걸린 경우 */
  miss?: string;
}

const KEY = "gfacts";
/** 다시 받기까지 (약관 30일보다 넉넉히) */
const REFRESH_DAYS = 10;
/** 못 찾은 곳은 한 달 뒤 다시 */
const MISS_RETRY_DAYS = 30;
const MAX_KM = 2;
const HIST_MAX = 12;
const DETAILS = APIS.find((a) => a.id === "google-details");
const IDS = APIS.find((a) => a.id === "google-ids");
// 리뷰 글은 받지 않는다. editorialSummary·편의 정보가 들어가 'Enterprise + Atmosphere' SKU (이것도 월 1,000건 무료)
const FIELDS =
  "id,displayName,location,rating,userRatingCount,regularOpeningHours,currentOpeningHours,businessStatus,googleMapsUri,nationalPhoneNumber,websiteUri," +
  "editorialSummary,parkingOptions,accessibilityOptions,goodForChildren,restroom,allowsDogs";

/** 구글 정보를 받을 장소: 한 곳짜리 시설만 (거리·해변·공항·축제는 지역이라 빼고, 오락실·클라이밍장처럼 구글 사진을 쓰는 곳은 포함) */
const FACT_CATEGORIES = new Set<Category>(["landmark", "themepark", "waterpark", "ski", "indoor"]);
export const wantsFacts = (p: Place) => !p.eventDate && !p.airport && (FACT_CATEGORIES.has(p.category) || GOOGLE_PHOTO.has(p.id));

/** 실측 원천이 있는 곳 (서울시 인구·놀이기구 대기·공항·부산 생활인구·주차장): 인기도 사전값을 쓰지 않는다 */
export const liveMeasured = (p: Place) =>
  !!(p.seoulArea || p.themeparksId || p.queueTimesId || p.airport || p.busanDongs?.length || PARKING_LOTS[p.id]);

// ── 구글 응답 → 운영 시간 ──

interface GPoint {
  day: number;
  hour?: number;
  minute?: number;
  date?: { year: number; month: number; day: number };
}
export interface GPeriod {
  open?: GPoint;
  close?: GPoint;
}

const dec = (pt: GPoint) => (pt.hour ?? 0) + (pt.minute ?? 0) / 60;
const round2 = (n: number) => Math.round(n * 100) / 100;
const ymd = (d: { year: number; month: number; day: number }) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

/** 한 구간의 [여는 시각, 닫는 시각]. 다음 날 닫으면 24를 더한다 (금 18시~토 2시 → [18, 26]) */
function span(p: GPeriod): Hours | null {
  if (!p.open) return null;
  const o = dec(p.open);
  if (!p.close) return [o, 24];
  let c = dec(p.close) + ((p.close.day - p.open.day + 7) % 7) * 24;
  if (c <= o) c += 24;
  return [round2(o), round2(Math.min(c, o + 24))];
}

/** 같은 날 여러 구간(점심 휴식)은 처음 여는 시각 ~ 마지막 닫는 시각으로 합친다 */
const merge = (a: Hours | null | undefined, b: Hours): Hours => (a ? [Math.min(a[0], b[0]), Math.max(a[1], b[1])] : b);

/** regularOpeningHours.periods → 요일별 운영 시간 (0=일). 구간이 없으면 모름(undefined), 구간이 없는 요일은 휴무(null) */
export function weekHours(periods?: GPeriod[]): (Hours | null)[] | undefined {
  if (!periods?.length) return undefined;
  // 24시간 영업: 일요일 0시에 열고 닫는 시각이 없는 구간 하나
  if (periods.length === 1 && periods[0].open && !periods[0].close) return Array.from({ length: 7 }, () => [0, 24] as Hours);
  const out: (Hours | null)[] = Array(7).fill(null);
  for (const p of periods) {
    const s = span(p);
    if (s && p.open) out[p.open.day] = merge(out[p.open.day], s);
  }
  return out;
}

/** currentOpeningHours → 특별 운영일 (날짜별 운영 시간, 그날 구간이 없으면 휴무 null) */
export function specialDays(cur?: { periods?: GPeriod[]; specialDays?: { date?: { year: number; month: number; day: number } }[] }): Record<string, Hours | null> | undefined {
  const days = (cur?.specialDays ?? []).flatMap((s) => (s.date ? [ymd(s.date)] : []));
  if (!days.length) return undefined;
  const out: Record<string, Hours | null> = Object.fromEntries(days.map((d) => [d, null]));
  for (const p of cur?.periods ?? []) {
    const d = p.open?.date && ymd(p.open.date);
    const s = span(p);
    if (d && d in out && s) out[d] = merge(out[d], s);
  }
  return out;
}

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** 그날 구글 운영 시간: 특별 운영일 → 요일별. 모르면 undefined, 휴무면 null */
export function googleHoursOn(f: Pick<GoogleFacts, "week" | "special">, date: string): Hours | null | undefined {
  const sp = f.special?.[date];
  if (sp !== undefined) return sp;
  return f.week?.[weekdayOf(date)];
}

// ── 인기도 사전값 ──

/** 리뷰가 하루에 몇 개씩 느는지 (기록이 14일 넘게 쌓였을 때만) */
export function reviewVelocity(hist?: [string, number][]): number | undefined {
  if (!hist || hist.length < 2) return undefined;
  const [d0, c0] = hist[0];
  const [d1, c1] = hist[hist.length - 1];
  const days = (Date.parse(d1) - Date.parse(d0)) / 86_400_000;
  return days >= 14 ? Math.max(0, (c1 - c0) / days) : undefined;
}

/** 값들의 백분위 (0~1, 같은 값은 같은 백분위) */
function percentiles(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  return values.map((v) => {
    const lo = sorted.indexOf(v);
    const hi = sorted.lastIndexOf(v);
    return n > 1 ? (lo + hi) / 2 / (n - 1) : 0.5;
  });
}

/** 카테고리 안에서 비교할 최소 장소 수 (적으면 백분위가 의미 없다) */
const MIN_PEERS = 5;
/** 사전값 쪽으로 당기는 비율과 최대 변화폭 (손으로 정한 값이 기본, 조심스럽게) */
const PRIOR_WEIGHT = 0.4;
const PRIOR_MAX_SHIFT = 0.12;

/**
 * 구글 리뷰 수(로그)·증가 속도의 카테고리 안 백분위 → 그 카테고리의 손으로 정한 popularity 범위 안 값(사전값) →
 * 손으로 정한 값을 그쪽으로 40%만, 최대 ±0.12 당긴다. 실측 원천이 있는 곳은 빼고 돌려준다
 */
export function popularityPriors(places: Place[], facts: Record<string, GoogleFacts | undefined>): Map<string, number> {
  const out = new Map<string, number>();
  const byCat = new Map<Category, Place[]>();
  for (const p of places) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
  for (const all of byCat.values()) {
    const rated = all.filter((p) => (facts[p.id]?.count ?? 0) > 0 && !facts[p.id]?.miss);
    if (rated.length < MIN_PEERS) continue;
    const countPct = percentiles(rated.map((p) => Math.log1p(facts[p.id]!.count!)));
    const vel = rated.map((p) => reviewVelocity(facts[p.id]!.hist));
    const withVel = rated.flatMap((p, i) => (vel[i] !== undefined ? [i] : []));
    const velPct = withVel.length >= MIN_PEERS ? percentiles(withVel.map((i) => vel[i]!)) : [];
    const pops = all.map((p) => p.popularity);
    let [lo, hi] = [Math.min(...pops), Math.max(...pops)];
    if (hi - lo < 0.2) [lo, hi] = [Math.max(0.05, (lo + hi) / 2 - 0.1), Math.min(1, (lo + hi) / 2 + 0.1)];
    rated.forEach((p, i) => {
      if (liveMeasured(p)) return;
      const vi = withVel.indexOf(i);
      const pct = vi >= 0 && velPct.length ? 0.6 * countPct[i] + 0.4 * velPct[vi] : countPct[i];
      const prior = lo + (hi - lo) * pct;
      const shift = Math.max(-PRIOR_MAX_SHIFT, Math.min(PRIOR_MAX_SHIFT, PRIOR_WEIGHT * (prior - p.popularity)));
      out.set(p.id, Math.round((p.popularity + shift) * 1000) / 1000);
    });
  }
  return out;
}

/**
 * 구글 정보를 장소에 반영한다 (정보가 없으면 그대로).
 * - 운영 시간: TourAPI에서 오늘 운영 시간을 못 찾은 곳만 구글 요일별·특별 운영 시간으로 (행사 제외)
 * - 오늘 휴무: TourAPI 휴무 또는 구글이 오늘 쉰다고 하면 (TourAPI 시간이 있는 곳은 구글 특별 휴무일만 본다)
 * - 인기도: popularityPriors 값이 있으면 (실측 원천이 없는 곳만 들어 있다)
 */
export function applyFacts(place: Place, f: GoogleFacts | undefined, prior?: number, date = kst().date): Place {
  const popularity = prior ?? place.popularity;
  if (!f || f.miss) return prior === undefined ? place : { ...place, popularity };
  const info = place.info ?? { hoursVerified: false };
  const useHours = !info.hoursVerified && !place.eventDate && !!f.week;
  const today = useHours ? googleHoursOn(f, date) : f.special?.[date];
  const closed = info.closedToday || today === null;
  const google = { rating: f.rating, count: f.count, uri: f.uri, summary: f.summary, phone: f.phone, web: f.web, amen: f.amen };
  return {
    ...place,
    popularity,
    hours: useHours && today ? today : place.hours,
    info: {
      ...info,
      ...(useHours && today !== undefined && { hoursVerified: true, hoursSource: "google" as const }),
      ...(useHours && { week: f.week, special: f.special }),
      ...(closed && { closedToday: true }),
      google,
    },
  };
}

/** 받은 리뷰 수를 기록에 더한다 (같은 날은 바꿔 쓰고, 최근 HIST_MAX개만) */
export function pushHist(hist: [string, number][] | undefined, date: string, count: number | undefined): [string, number][] | undefined {
  if (count === undefined) return hist;
  const h = (hist ?? []).filter(([d]) => d !== date);
  return [...h, [date, count] as [string, number]].slice(-HIST_MAX);
}

// ── 저장 (Redis 해시 하나, 필드 = 우리 장소 id) ──

export async function readAllFacts(): Promise<Record<string, GoogleFacts>> {
  const [flat] = (await kv.pipeline([["HGETALL", KEY]])) as [string[] | null];
  const out: Record<string, GoogleFacts> = {};
  for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) {
    try {
      out[flat![i]] = JSON.parse(flat![i + 1]) as GoogleFacts;
    } catch {
      // 깨진 값은 건너뛴다 (다음 갱신 때 다시 쓴다)
    }
  }
  return out;
}

async function saveFacts(id: string, f: GoogleFacts): Promise<void> {
  await kv.pipeline([["HSET", KEY, id, JSON.stringify(f)]]);
}

// 화면·수집기가 매번 Redis를 읽지 않게 인스턴스 메모리에 10분 (빌드 때 페이지마다 읽으면 Upstash 명령 수가 는다)
const MEMO_MS = 10 * 60 * 1000;
let memo: { t: number; v: Promise<{ facts: Record<string, GoogleFacts>; priors: Map<string, number> }> } | null = null;

/** 모든 장소의 구글 정보와 인기도 사전값 (실패하면 비어 있음 → 기존 동작 그대로) */
export function getGoogleFacts(places: Place[]): Promise<{ facts: Record<string, GoogleFacts>; priors: Map<string, number> }> {
  if (memo && Date.now() - memo.t < MEMO_MS) return memo.v;
  const v = readAllFacts()
    .catch(() => ({}) as Record<string, GoogleFacts>)
    .then((facts) => ({ facts, priors: popularityPriors(places, facts) }));
  memo = { t: Date.now(), v };
  return v;
}

// ── 구글에서 받기 ──

const ageDays = (f: GoogleFacts | undefined, now: number) => (f ? (now - Date.parse(f.at)) / 86_400_000 : Infinity);

/** 다시 받을 때가 된 장소 (한 번도 안 받은 곳 → 오래된 곳 순) */
export function staleForFacts(places: Place[], facts: Record<string, GoogleFacts | undefined>, now = Date.now()): Place[] {
  return places
    .filter(wantsFacts)
    .filter((p) => ageDays(facts[p.id], now) >= (facts[p.id]?.miss ? MISS_RETRY_DAYS : REFRESH_DAYS))
    .sort((a, b) => ageDays(facts[b.id], now) - ageDays(facts[a.id], now));
}

async function findGid(p: Place, key: string): Promise<string | undefined> {
  await countCall(IDS);
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id" },
    body: JSON.stringify({ textQuery: p.name, languageCode: "ko", regionCode: "KR", locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 1500 } } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`구글 검색 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { places?: { id?: string }[] }).places?.[0]?.id;
}

export interface GDetails {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { periods?: GPeriod[] };
  currentOpeningHours?: { periods?: GPeriod[]; specialDays?: { date?: { year: number; month: number; day: number } }[] };
  businessStatus?: string;
  googleMapsUri?: string;
  editorialSummary?: { text?: string };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  parkingOptions?: Record<string, boolean>;
  accessibilityOptions?: Record<string, boolean>;
  goodForChildren?: boolean;
  restroom?: boolean;
  allowsDogs?: boolean;
}

/** 구글 편의 정보 키 → 화면 이름 (true인 것만 저장·표시) */
export const AMENITY_LABEL: Record<string, string> = {
  freeParkingLot: "무료 주차장",
  paidParkingLot: "유료 주차장",
  freeGarageParking: "무료 주차 건물",
  paidGarageParking: "유료 주차 건물",
  freeStreetParking: "무료 노상 주차",
  paidStreetParking: "유료 노상 주차",
  valetParking: "발레 주차",
  wheelchairAccessibleEntrance: "휠체어 출입구",
  wheelchairAccessibleParking: "휠체어 주차",
  wheelchairAccessibleRestroom: "휠체어 화장실",
  wheelchairAccessibleSeating: "휠체어 좌석",
  goodForChildren: "아이와 가기 좋음",
  restroom: "화장실",
  allowsDogs: "반려견 동반",
};

/** 구글이 준 위치가 우리 좌표에서 이보다 멀면 다른 곳(같은 이름의 다른 지점)이 걸린 것. 스키장은 리조트가 넓어 3km */
export const maxKm = (p: Place) => (p.category === "ski" ? 3 : MAX_KM);

/** Place Details 응답 → 저장할 값. 너무 멀면 miss */
export function factsFromDetails(p: Place, d: GDetails, prev: GoogleFacts | undefined, at: string, date = kst().date): GoogleFacts {
  const km = d.location ? distanceKm({ lat: p.lat, lng: p.lng }, { lat: d.location.latitude, lng: d.location.longitude }) : 0;
  if (km > maxKm(p)) return { at, name: d.displayName?.text, miss: `${Math.round(km * 10) / 10}km 떨어진 곳이 걸림` };
  const flags = { ...d.parkingOptions, ...d.accessibilityOptions, goodForChildren: d.goodForChildren, restroom: d.restroom, allowsDogs: d.allowsDogs };
  const amen = Object.keys(AMENITY_LABEL).filter((k) => flags[k as keyof typeof flags] === true);
  return {
    gid: d.id ?? prev?.gid,
    name: d.displayName?.text,
    rating: d.rating,
    count: d.userRatingCount,
    hist: pushHist(prev?.hist, date, d.userRatingCount),
    week: weekHours(d.regularOpeningHours?.periods),
    special: specialDays(d.currentOpeningHours),
    status: d.businessStatus,
    uri: d.googleMapsUri,
    summary: d.editorialSummary?.text || undefined,
    phone: d.nationalPhoneNumber,
    web: d.websiteUri,
    amen: amen.length ? amen : undefined,
    at,
  };
}

/** 한 곳을 받아 저장할 값으로. 상세 호출은 이달 한도(90%)를 넘으면 QuotaError */
async function fetchOne(p: Place, prev: GoogleFacts | undefined, key: string): Promise<GoogleFacts> {
  const at = new Date().toISOString();
  const gid = prev?.gid ?? (await findGid(p, key));
  if (!gid) return { at, miss: "검색 결과 없음" };
  await beforeCall(DETAILS);
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(gid)}?languageCode=ko&regionCode=KR`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    signal: AbortSignal.timeout(10_000),
  });
  // 오래된 id는 404 → 다음 차례에 이름으로 다시 찾는다
  if (res.status === 404) return { at, miss: "구글 id 없어짐" };
  if (!res.ok) throw new Error(`구글 상세 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return factsFromDetails(p, { id: gid, ...((await res.json()) as GDetails) }, prev, at);
}

export interface FactsRun {
  fetched: number;
  matched: number;
  missed: string[];
  closed: { id: string; name: string; status: string }[];
  errors: string[];
  remaining: number;
}

/** 다시 받을 때가 된 장소를 size곳까지 받는다 (수집기 매시 몇 곳, 처음 채울 때는 api/cron/google-facts) */
export async function refreshGoogleFacts(places: Place[], size: number): Promise<FactsRun> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const run: FactsRun = { fetched: 0, matched: 0, missed: [], closed: [], errors: [], remaining: 0 };
  if (!key) return run;
  const facts = await readAllFacts();
  const due = staleForFacts(places, facts);
  const batch = due.slice(0, size);
  run.remaining = due.length - batch.length;
  // 5곳씩 동시에 (요청 시간 60초 안에)
  for (let i = 0; i < batch.length; i += 5) {
    const results = await Promise.all(
      batch.slice(i, i + 5).map(async (p) => {
        try {
          const f = await fetchOne(p, facts[p.id], key);
          await saveFacts(p.id, f);
          return { p, f };
        } catch (e) {
          if (e instanceof QuotaError) return { p, quota: e.message };
          return { p, error: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
    let stop = false;
    for (const r of results) {
      if ("quota" in r) {
        run.errors.push(r.quota!);
        stop = true;
      } else if ("error" in r) run.errors.push(`${r.p.id}: ${r.error}`);
      else {
        run.fetched++;
        if (r.f.miss) run.missed.push(`${r.p.id}(${r.f.miss}${r.f.name ? ` ${r.f.name}` : ""})`);
        else run.matched++;
        // 계절 영업 장소가 시즌 밖에 '임시 휴업'인 건 정상 (스키장 여름)
        const offSeason = r.f.status === "CLOSED_TEMPORARILY" && !inSeason(r.p, kst().date);
        if (r.f.status && r.f.status !== "OPERATIONAL" && !offSeason) run.closed.push({ id: r.p.id, name: r.p.name, status: r.f.status });
      }
    }
    if (stop) break;
  }
  memo = null;
  for (const c of run.closed)
    await opsAlert(
      `구글 지도: ${c.name} ${c.status === "CLOSED_PERMANENTLY" ? "폐업" : "임시 휴업"} 표시`,
      `${c.id} — 장소는 그대로 두었어요. 확인 후 정리`,
      { key: `gclosed:${c.id}:${c.status}`, cooldownS: 7 * 86_400 },
    );
  // 키 권한·결제 문제처럼 전부 실패하면 알린다
  if (run.errors.length && !run.fetched) await opsAlert("구글 장소 정보 받기 실패", run.errors.slice(0, 3).join("\n"), { key: "gfacts-fail", cooldownS: 6 * 3600 });
  return run;
}
