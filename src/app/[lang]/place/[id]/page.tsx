import { DroneVideos } from "@/components/DroneVideos";
import { LiveCountButton } from "@/components/place/LiveCountButton";
import { TripBrief } from "@/components/place/TripBrief";
import { tripBriefAi } from "@/lib/trip-brief";
import { HolidayRibbon } from "@/components/home/HolidayRibbon";
import { krDayOn } from "@/lib/kr-days";
import { videosFor } from "@/lib/kto-videos";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { placeTag } from "@/lib/category-style";
import { StayLinks, TourLinks } from "@/components/StayLinks";
import type { Metadata } from "next";
import placeImages from "@/data/korea/place-images.json";
import { heroImage, placePhotos } from "@/lib/place-photos";
import { breadcrumbLd, jsonLd, kstClock, pageMeta, SITE } from "@/lib/seo";
import { HourlyChart } from "@/components/charts/lazy";
import { LevelBadge } from "@/components/Level";
import { PlaceHero } from "@/components/PlaceHero";
import { dayHours, forecastForDate, forecastReasons, weekForecast } from "@/lib/crowd/model";
import { UpcomingHours } from "@/components/PlaceForecast";
import { TripWatchButton } from "@/components/TripWatchButton";
import { getHistory, type HistoryPoint } from "@/lib/crowd/history";
import { getSignals } from "@/lib/crowd/signals";
import { getCrowd } from "@/lib/crowd/service";
import { sitePeople, siteShare, withPeople } from "@/lib/crowd/provider";
import { levelOf, valueFromScore, inkOf } from "@/lib/levels";
import { closedToday, getLivePlace, isOngoingEvent } from "@/lib/place-info";
import { CrowdMascot } from "@/components/place/CrowdMascot";
import { categoryCharacter } from "@/lib/characters";
import { ForecastTabs } from "@/components/place/ForecastTabs";
import { MonthCalendar } from "@/components/place/MonthCalendar";
import { HourTable } from "@/components/place/HourTable";
import { YearOverview } from "@/components/place/YearOverview";
import { AlertFab } from "@/components/place/AlertFab";
import { WeekHeatmap } from "@/components/WeekHeatmap";
import { splitInfoNote } from "@/lib/info-note";
import { PLACES, placeHref } from "@/lib/places";
import { cadenceMinutes } from "@/lib/crowd/cadence";
import { addDays, daysUntil, formatClock, kst } from "@/lib/time";
import type { Lang } from "@/i18n/config";
import { DEFAULT_LANG, isLang, localePath } from "@/i18n/config";
import { fmtAge, fmtMinutes, fmtPeople, trReason } from "@/i18n/patterns";
import { getT } from "@/i18n/server";
import { formatHour, type T } from "@/i18n/translate";
import type { CrowdResult, HourPoint } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";
import { DataTag } from "@/components/DataTag";
import { AMENITY_LABEL } from "@/lib/google-facts";
import { researchOf } from "@/lib/research-facts";
import { ResearchFactsBlock } from "@/components/ResearchFactsBlock";
import { JudgementCard } from "@/components/JudgementCard";
import { SeoulPeopleProfile, VisitorProfile } from "@/components/VisitorProfile";
import { WeatherCard } from "@/components/WeatherCard";
import { RoadSection } from "@/components/RoadCard";
import { InlineAd } from "@/components/AdUnit";
import { NearbyChips, NearbyRail } from "@/components/NearbyRail";
import { CROWD_PAGES } from "@/lib/crowd-pages";
import { FaqBlock } from "@/components/FaqBlock";
import { CalmAlternatives } from "@/components/CalmAlternatives";
import { CrowdReport } from "@/components/CrowdReport";
import { pushEnabled } from "@/lib/alerts";
import { authEnabled } from "@/lib/auth";
import { compactNumber, headcountInfo, isEstimated } from "@/lib/format";
import { translateNames } from "@/lib/name-translate";
import { getPlaceNews } from "@/lib/trending";
import { getRelatedPlaces } from "@/lib/related-places";
import { locateByName } from "@/lib/related-geo";
import { distanceKm } from "@/lib/geo";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { getAllSeoulLive } from "@/lib/seoul-live";
import Link from "@/i18n/link";
import { KstNote, LocalTime } from "@/components/LocalTime";
import { dataGrade, GRADE_LABEL } from "@/lib/data-grade";
import { Glyph } from "@/components/Glyph";
import { UsualBand } from "@/components/UsualBand";
import { TrackRecent } from "@/components/TrackRecent";
import { cellOf } from "@/lib/crowd/model";
import { usualBand } from "@/lib/crowd/percentile";

// ISR: CDN이 5분 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
// 관광공사 사진 여러 장 (scripts/korea-data/place-images.mjs)
const PLACE_IMAGES = placeImages as Record<string, string[]>;

// (60초였을 때 ISR 쓰기 5일에 13만 건. 데이터는 10분마다 갱신되니 5분이면 충분)
export const revalidate = 300;

const SOURCE_LABEL: Record<CrowdResult["source"], string> = {
  "seoul-citydata": "서울시 실시간 도시데이터",
  "incheon-airport": "인천국제공항공사 출국장 혼잡도",
  "kac-airport": "한국공항공사 공항 혼잡도",
  "themeparks-wiki": "놀이기구 대기시간 · Powered by ThemeParks.wiki",
  "queue-times": "놀이기구 대기시간 · Powered by Queue-Times.com",
  parking: "주차장 실시간 주차 × 평소 대비 (CrowdView 추정)",
  model: "CrowdView 추정 (요일·시간·날씨 패턴)",
};

// 빌드 때 장소별 페이지를 미리 만들어 두고, 이후엔 위 주기로 갱신한다
// 빌드 때는 한국어만 미리 만들고 다른 언어는 처음 열 때 만든다 (빌드 페이지 약 1,300개 → 500개 아래, Vercel 빌드 시간 절약)
export function generateStaticParams({ params }: { params: { lang: string } }) {
  if (params.lang !== DEFAULT_LANG) return [];
  // 클라이밍장 159곳(climb-*)은 처음 열 때 만든다 (빌드 시간·빌드 중 API 호출을 늘리지 않게)
  return PLACES.filter((p) => !p.id.startsWith("climb-")).map((p) => ({ id: p.id }));
}

const weekday = (date: string, lang: Lang, style: "long" | "short") =>
  new Intl.DateTimeFormat(lang, { weekday: style, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
function dayName(date: string, t: T, lang: Lang): string {
  const diff = daysUntil(date);
  if (diff === 0) return t("오늘");
  if (diff === 1) return t("내일");
  return weekday(date, lang, "long");
}

/**
 * 예측 곡선의 지난 시간을 실측 기록으로 바꾼다. people: 기록의 인원을 화면 인원으로 (실제 인원일 때만, 아니면 undefined)
 * kind: 그 인원의 종류 (서울시 주변 지역 실측을 명소 기준으로 줄였으면 "area")
 */
function withRecordedHours(
  points: HourPoint[],
  records: HistoryPoint[],
  people: ((n: number) => number) | undefined,
  kind: HourPoint["peopleKind"] = "real",
): HourPoint[] {
  const byHour = new Map<number, HistoryPoint>();
  for (const r of records) byHour.set(Math.floor(kst(new Date(r.t)).hour), r);
  return points.map((p) => {
    const r = !p.forecast ? byHour.get(p.hour) : undefined;
    if (!r) return p;
    return people ? { ...p, score: r.score, people: people(r.headcount), peopleKind: kind } : { ...p, score: r.score };
  });
}

/** 오늘·내일·수 */
function shortDay(date: string, t: T, lang: Lang): string {
  const diff = daysUntil(date);
  if (diff === 0) return t("오늘");
  if (diff === 1) return t("내일");
  return weekday(date, lang, "short");
}

/** 영업시간 내 앞으로 가장 한산한 시간 */
/** 오늘 남은 시간 중 가장 한산한 시 — 입장해서 1시간 이상 볼 수 있는 시각만 (마감 1시간 전 입장 마감 가정) */
function bestUpcoming(points: HourPoint[], open: number, close: number): HourPoint | undefined {
  const last = close >= 24 ? 23 : close - 2;
  return points.filter((p) => p.forecast && p.hour >= open && p.hour <= last).sort((a, b) => a.score - b.score)[0];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; lang: string }> }): Promise<Metadata> {
  const { id, lang } = await params;
  const place = PLACES.find((p) => p.id === id);
  if (!place) return {};
  const t = getT(lang);
  return pageMeta({
    lang,
    path: placeHref(place),
    // 실측 데이터가 없는 곳은 제목에도 '예측'이라고 쓴다.
    // 사람들이 실제로 치는 말('오늘 에버랜드 사람 많나요')을 제목·설명에 (총점검 10/30: 서치콘솔에 '혼잡도' 검색어로만 노출, '사람'으로는 거의 없었다)
    title:
      place.seoulArea || place.themeparksId || place.airport
        ? t("{name} 혼잡도 · 오늘 사람 많나요? 실시간 확인", { name: t(place.name) })
        : t("{name} 혼잡도 예측 · 오늘 사람 많을까? 한산한 시간", { name: t(place.name) }),
    description: t("{name} 오늘 사람 얼마나 많은지 지금 혼잡도와 시간대별 예측으로 확인하고, 한산한 시간에 가세요", { name: t(place.name) }),
    // 공유 미리보기: 대표 사진 위에 그 순간 혼잡도 카드 (opengraph-image.tsx, 10/31 '알리기' 1번).
    // 주소에 10분 단위 꼬리를 붙여, 카톡이 페이지를 다시 읽을 때 옛 카드를 그대로 쓰지 않게
    image: `${SITE}${localePath(isLang(lang) ? lang : DEFAULT_LANG, `${placeHref(place)}/opengraph-image`)}?t=${Math.floor(Date.now() / 600_000)}`,
  });
}

export default async function PlacePage({ params }: { params: Promise<{ id: string; lang: string }> }) {
  const { id } = await params;
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  // 운영 시간·행사 일정은 한국관광공사 TourAPI 값 (없으면 places.ts의 임의 값)
  const [place, crowd] = await Promise.all([getLivePlace(id), getCrowd(id)]);
  if (!place || !crowd) notFound();
  const crowdPage = CROWD_PAGES.find((c) => c.kind === "place" && c.id === place.id);
  if (place.category === "airport") redirect(localePath(lang, placeHref(place)));
  const [signals, [today], related, news] = await Promise.all([getSignals(place), getHistory(id, 1), getRelatedPlaces(place), getPlaceNews(id)]);
  // 최근 소식 제목: 기사는 한국어라 제목 번역은 영어 화면만 (10/24 Papago 사용량: 날마다 바뀌는 제목을 4개 언어로 번역하던 것을 줄임)
  const newsTr = news?.hits.length && lang === "en" ? await translateNames(news.hits.map((h) => h.title), lang) : new Map<string, string>();
  const relatedNames = await translateNames(
    related.flatMap((r) => [r.name, r.region]),
    lang,
  );
  // 운영 시간·휴무 안내(관광공사 한국어 글)도 외국어 화면에서는 번역 (Papago 캐시). 번역기는 줄 단위라 줄바꿈을 ' / '로 펴서 보낸다
  const flat = (x?: string) => x?.replace(/\s*\n+\s*/g, " / ").trim();
  const infoTr = await translateNames([flat(place.info?.hoursText), flat(place.info?.restText)], lang);
  const trInfo = (x?: string) => (x ? (infoTr.get(flat(x)!) ?? x) : x);
  // '※' 안내는 따로 줄로, 위 줄과 같은 운영 시간은 빼고 (lib/info-note)
  const hoursNote = place.info?.hoursText ? splitInfoNote(trInfo(place.info.hoursText)!, place.hours) : null;
  const restNote = place.info?.restText ? splitInfoNote(trInfo(place.info.restText)!) : null;
  // 주소도 외국어 화면에서는 번역 (외부 점검: en 화면 한국어 노출)
  const address = (await translateNames([place.address], lang)).get(place.address) ?? place.address;
  // 구글 지도 소개 한 줄(한국어)도 외국어 화면에서는 번역 (Papago 캐시)
  const g = place.info?.google;
  const gSummary = g?.summary && lang !== "ko" ? ((await translateNames([g.summary], lang)).get(g.summary) ?? g.summary) : g?.summary;
  // 웹 조사 혼잡 정보 (lib/research-facts): 대기·팁 문장은 외국어 화면에서 번역
  const research = researchOf(place.id);
  const researchTr = research && lang !== "ko" ? await translateNames([research.wait?.[0], ...(research.tips ?? []).slice(0, 3)], lang) : undefined;
  // 주변 서울 실시간 지역 이름도 외국어로 (자체 QA 10/22: en·ja에 '잠실 관광특구'가 한글로)
  const areaTr = await translateNames([crowd.area?.name, place.seoulArea], lang);
  const areaLabel = (x?: string): string => (x ? (areaTr.get(x) ?? t(x)) : "");
  // 화면의 '○시 기준'은 한 값만: 원천의 관측 시각(서울시 등), 없으면 CrowdView가 받은 시각 (P1-2 기준 시각 단일화)
  const basisTime = crowd.observedAt ? crowd.observedAt.slice(11, 16) : kstClock(crowd.updatedAt);
  // 함께 가면 좋은 곳: 이름으로 좌표를 찾아 거리 + 그 근처(1km 안 서울 실시간 지역) 지금 혼잡
  const seoulNow = await getAllSeoulLive().catch(() => ({}) as Awaited<ReturnType<typeof getAllSeoulLive>>);
  // 연관 목록에 이 장소 자신이 다른 표기로 섞여 온다 (예: 롯데월드어드벤쳐) → 띄어쓰기·쳐/처 같은 표기 차이를 무시하고 뺀다
  const sameName = (x: string) => x.replace(/\s/g, "").replace(/쳐/g, "처").replace(/져/g, "저").replace(/쪄/g, "쩌");
  const selfName = sameName(place.name);
  const relatedInfo = related
    .filter((r) => sameName(r.name) !== selfName && !selfName.includes(sameName(r.name)))
    .map((r) => {
      const at = locateByName(r.name, place);
      const area =
        at &&
        SEOUL_AREAS.map((a) => ({ a, km: distanceKm(a, at) }))
          .filter((x) => x.km <= 1 && seoulNow[x.a.code])
          .sort((x, y) => x.km - y.km)[0];
      return { ...r, km: at?.km, href: at?.href, score: area ? seoulNow[area.a.code].score : undefined };
    });
  const seoulCode = place.seoulArea ? SEOUL_AREAS.find((a) => a.name === place.seoulArea)?.code : undefined;
  const seoulProfile = seoulCode ? seoulNow[seoulCode]?.profile : undefined;
  // 백분위 혼잡지수: 서울시 지역 인원은 서울 쪽 분포, 놀이공원·공항 실측은 장소 점수 분포 (표본이 모자라면 없음)
  const seoulRow = seoulCode ? seoulNow[seoulCode] : undefined;
  const band =
    crowd.source === "seoul-citydata" && seoulCode && seoulRow
      ? await usualBand("seoul", seoulCode, Math.round((seoulRow.min + seoulRow.max) / 2))
      : crowd.source !== "model"
        ? await usualBand("place", place.id, crowd.score)
        : undefined;
  const weekend = cellOf(kst(), signals.holidays) >= 24;
  // 오늘 지난 시간은 10분마다 쌓은 실측 기록으로 채운다 (시간마다 마지막 기록)
  // 서울시 명소: 10/20 이전 기록은 주변 지역 인원 그대로라, 장소 수용 인원보다 한참 크면 명소 기준으로 줄인다
  const share = siteShare(place);
  const recordPeople = (n: number) => (crowd.area && n > place.capacity * 1.5 ? Math.round((n * share) / 100) * 100 : n);
  const hourly = withPeople(
    place,
    withRecordedHours(crowd.hourly, today.points, crowd.source !== "model" && place.criteria?.unit === "명" ? recordPeople : undefined, crowd.area ? "area" : "real"),
  );
  const week = weekForecast(place, signals);
  // 예상 인원: 점수 대신 사람 수로 (경수님 10/29: 단위는 모두 사람). 인원 기준이 없는 곳(대기 분 기준 놀이공원 등)·지역 안 시설(롯데월드)은 시설 정원 기준
  const steps = place.criteria?.unit === "명" ? place.criteria.steps : undefined;
  const peopleAt = (score: number) => (steps && !crowd.area ? Math.round(valueFromScore(score, steps) / 100) * 100 : sitePeople(place, score));
  const peopleText = (score: number) => t("약 {v}", { v: fmtPeople(peopleAt(score), t, lang) });
  const calmest = week.reduce((a, b) => (b.peakScore < a.peakScore ? b : a));
  const todayPeak = week[0];
  const todayReasons = forecastReasons(place, todayPeak.date, todayPeak.peakHour + 0.5, signals);

  const now = kst();
  const isOpen = crowd.open;
  const level = isOpen
    ? levelOf(crowd.score)
    : {
        label: crowd.offSeason ? "시즌 아님" : "운영 종료",
        desc:
          crowd.offSeason && place.season
            ? t("{from}월 ~ {to}월에만 운영해요", { from: place.season[0], to: place.season[1] })
            : t("운영 시간 {from} ~ {to}", { from: formatHour(place.hours[0], lang), to: formatHour(place.hours[1], lang) }),
        color: "#6b7280",
      };
  const best = bestUpcoming(crowd.hourly, ...place.hours);
  // 지금부터 입장 가능한 마지막 시간(마감 2시간 전)까지 시간마다 예상 (QA: '이 시간 이후로' 보이게)
  const lastHour = place.hours[1] >= 24 ? 23 : place.hours[1] - 2;
  const upcoming = hourly
    .filter((p) => p.hour >= Math.floor(now.hour) && p.hour >= place.hours[0] && p.hour <= lastHour)
    .map((p) => ({ hour: p.hour, label: formatHour(p.hour, lang), score: p.score, people: p.people ?? peopleAt(p.score) }));
  // 한 달·1년 탭: 날마다 가장 붐빌 때 (추정)
  const long = weekForecast(place, signals, 365);
  // 달력 칸: 한 달 달력(5주)·1년(365일)이 같이 쓴다 (사용자 10/23: 석 달 달력 → 한 달 달력 + 1년 탭)
  const calCells = long.map((d) => ({
    date: d.date,
    peakScore: d.peakScore,
    peakLabel: formatHour(d.peakHour, lang),
    long: `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))} (${weekday(d.date, lang, "short")})`,
    reasons: d.reasons.map((r) => trReason(r, t)),
    people: peopleText(d.peakScore),
  }));
  // 자주 묻는 질문 '○월엔 언제 가면 한산한가요?' (10/31 알리기 2번: '에버랜드 11월 혼잡도'처럼 날짜로 찾는 검색.
  // 장소×월 페이지를 새로 만들면 비슷한 자동 페이지가 수백 개 늘어 색인에 역효과라, 이 화면의 질문·답(FAQPage)으로)
  const monthAhead = long.slice(1, 31);
  const monthName = new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : lang, { month: "long", timeZone: "Asia/Seoul" }).format(new Date(`${addDays(kst().date, 15)}T12:00:00+09:00`));
  const dayLabel = (date: string) => calCells.find((c) => c.date === date)?.long ?? date;
  const byScore = [...monthAhead].sort((a, b) => a.peakScore - b.peakScore);
  const calmDays = byScore.slice(0, 3).sort((a, b) => a.date.localeCompare(b.date));
  const busyDays = byScore.slice(-2).sort((a, b) => a.date.localeCompare(b.date));
  const isWeekend = (d: string) => [0, 6].includes(new Date(`${d}T12:00:00+09:00`).getUTCDay());
  const avgPeak = (xs: typeof monthAhead) => xs.reduce((n, x) => n + x.peakScore, 0) / Math.max(1, xs.length);
  const weekendGap = avgPeak(monthAhead.filter((d) => isWeekend(d.date))) - avgPeak(monthAhead.filter((d) => !isWeekend(d.date)));
  const monthFaq =
    place.category !== "event" && monthAhead.length >= 20
      ? {
          q: t("{name} {month}엔 언제 가면 한산한가요?", { name: t(place.name), month: monthName }),
          a: [
            t("앞으로 한 달 예측으로는 {calm}이 가장 한산하고, {busy}이 가장 붐빌 것으로 보여요.", {
              calm: calmDays.map((d) => dayLabel(d.date)).join(", "),
              busy: busyDays.map((d) => dayLabel(d.date)).join(", "),
            }),
            weekendGap >= 8 ? t("주말이 평일보다 꽤 붐벼요. 평일에 가면 여유로워요.") : weekendGap <= -8 ? t("오히려 평일이 주말보다 붐비는 곳이에요.") : "",
          ]
            .filter(Boolean)
            .join(" "),
        }
      : null;
  // 놀이기구 구역별 평균 대기 (구역을 아는 공원만)
  const areas = [...new Set((crowd.zones ?? []).map((z) => z.area).filter((a): a is string => !!a))]
    .map((name) => {
      const rides = crowd.zones!.filter((z) => z.area === name);
      return { name, rides, avg: Math.round(rides.reduce((a, z) => a + (z.waitMin ?? 0), 0) / rides.length) };
    })
    .sort((a, b) => b.avg - a.avg);
  // 이번 주 × 시간: 오늘은 실측이 섞인 곡선, 다른 날은 예측. 운영 시간만, 정기 휴무일은 비움
  const heatDays = week.map((d, i) => {
    const closed =
      (i === 0 && !!place.info?.closedToday) || (i > 0 && ((!!place.info?.restText && closedToday(place.info.restText, d.date)) || dayHours(place, d.date) === null));
    const pts = i === 0 ? hourly : forecastForDate(place, d.date, signals);
    return {
      date: d.date,
      label: shortDay(d.date, t, lang),
      closed,
      hours: closed
        ? []
        : pts
            .filter((p) => p.hour >= place.hours[0] && p.hour < Math.min(24, place.hours[1]))
            .map((p) => ({ hour: p.hour, score: p.score, people: peopleText(p.score) })),
    };
  });
  const dday = place.eventDate ? daysUntil(place.eventDate) : null;
  const eventForecast = place.eventDate && dday !== null && dday > 0 ? forecastForDate(place, place.eventDate) : null;
  const eventPeak = eventForecast && [...eventForecast].sort((a, b) => b.score - a.score)[0];
  // 행사 장소인데 아직 열리기 전이면 '지금 혼잡도'는 행사 인원이 아니다 → 행사 전으로 표시
  const beforeEvent = place.category === "event" && dday !== null && dday > 0;
  // 입장 마감(마감 1시간 전)이 1시간도 안 남았으면 '지금이 가장 한산'이라고 하지 않는다
  const closingSoon = isOpen && place.hours[1] < 24 && kst().hour >= place.hours[1] - 2;
  const noBestText = closingSoon
    ? t("오늘은 입장 마감이 가까워요. 다음 방문은 아래 이번 주 예측을 참고하세요.")
    : t("오늘은 지금이 가장 한산한 편이에요.");

  return (
    <main>
      <TrackRecent id={place.id} href={placeHref(place)} title={place.name} img={heroImage(place)} sub={place.region} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type":
              { themepark: "AmusementPark", waterpark: "WaterPark", ski: "SkiResort", beach: "Beach" }[place.category as string] ??
              "TouristAttraction",
            name: t(place.name),
            description: t(place.description),
            url: `${SITE}${localePath(lang, placeHref(place))}`,
            address: { "@type": "PostalAddress", streetAddress: place.address, addressCountry: "KR" },
            geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
            ...(place.image && { image: `${SITE}${place.image}` }),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbLd(lang, [
              { name: "CrowdView", path: "/" },
              { name: t(CATEGORY_LABEL[place.category]), path: `/?cat=${place.category}` },
              { name: t(place.name), path: placeHref(place) },
            ]),
          ),
        }}
      />
      <PlaceHero
        place={place}
        gallery={PLACE_IMAGES[place.id] ?? []}
        photos={placePhotos(place.id).map((p) => ({
          src: p.src,
          alt: p.alt,
          href: p.page,
          credit: p.credit === "한국관광공사" ? t("사진 한국관광공사") : t("사진 {author} · {license}", { author: p.credit.replace(" / Wikimedia Commons", ""), license: p.license }),
        }))}
        // 세부 분류가 있으면 그 이름으로 (예: 테마파크 → 놀이공원·아쿠아리움). 누르면 홈의 그 분류 목록
        chips={[{ label: placeTag(place, t).label, href: `/?cat=${place.category}` }, { label: t(place.region) }]}
      />

      {/* 모바일: 한 줄로 쌓기 / PC: 왼쪽(지금·언제 갈까) 고정 + 오른쪽(그래프·정보) */}
      {/* 기념일 날만 인사 띠 (상세에는 떨어지는 효과 없음, 경수님 10/28) */}
      {krDayOn(kst().date) && (
        <div className="mt-4 px-5 md:mt-6 md:px-0">
          <HolidayRibbon day={krDayOn(kst().date)} className="" />
        </div>
      )}
      <div className="relative mt-5 px-5 md:mt-8 md:px-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-10">
        <div className="lg:sticky lg:top-24 lg:self-start">
          {/* 제목 묶음: 이름 → 한 줄 소개. 분류·지역 칩은 사진 위로, 한 문장 요약은 혼잡도 카드와 겹쳐 뺐다 (사용자 QA 10/22) */}
          <h1 className="pt-1 text-[28px] leading-tight font-extrabold tracking-tight text-gray-950 md:pt-0 md:text-[34px]">{t(place.name)}</h1>
          <p className="mt-2 text-base leading-7 font-medium text-gray-700">{t(place.description)}</p>
          <KstNote className="mt-1" />

          {/* 지금 혼잡도: 표정으로 단계를 보여 주는 캐릭터 (사용자 QA 10/22: 계기판 대신) */}
          <section className="mt-4 rounded-3xl px-4 py-4" style={{ background: `${level.color}24`, boxShadow: `inset 0 0 0 1.5px ${level.color}55` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-gray-800">{beforeEvent ? t("행사 정보") : t("지금 혼잡도")}</p>
                <p className="text-[34px] leading-tight font-black" style={beforeEvent ? undefined : { color: inkOf(level.color) }}>
                  {beforeEvent ? `${t("행사 전")} · D-${dday}` : t(level.label)}
                  {!beforeEvent && isOpen && isEstimated(crowd) && <DataTag className="text-xs" />}
                </p>
                <p className="mt-1 text-[17px] font-semibold text-gray-900">
                  {beforeEvent ? (
                    t("아직 행사가 열리지 않았어요. 행사 당일 예상 혼잡은 아래에서 확인하세요.")
                  ) : isOpen ? (
                    <>
                      {crowd.avgWaitMin !== undefined ? (
                        <>
                          {t("놀이기구 평균 대기")} <b className="whitespace-nowrap">{fmtMinutes(crowd.avgWaitMin, t)}</b>
                        </>
                      ) : (
                        // 숫자와 단위가 줄바꿈으로 갈라지지 않게 (UI QA 10차: '851 / 명')
                        <span className="whitespace-nowrap">{headcountInfo(crowd, { t, lang })?.text ?? t(level.desc)}</span>
                      )}
                      {crowd.avgWaitMin === undefined && headcountInfo(crowd)?.kind && <DataTag kind={headcountInfo(crowd)!.kind} />}
                      {crowd.trend === "up" && <span className="whitespace-nowrap text-red-700 dark:text-red-400"> · {t("늘어나는 중")}</span>}
                      {crowd.trend === "down" && <span className="whitespace-nowrap text-emerald-800 dark:text-emerald-400"> · {t("줄어드는 중")}</span>}
                    </>
                  ) : (
                    t(level.desc)
                  )}
                </p>
              </div>
              {!beforeEvent && <CrowdMascot score={crowd.score} closed={!isOpen} size={112} className="-my-1 shrink-0" label={t(level.label)} character={categoryCharacter(place.category)} />}
            </div>
            {/* 확정안 (경수님 10/30): 평소 대비를 첫 줄에 크게, 출처는 흐리고 작게 */}
            {(crowd.area || crowd.parking) && isOpen && !beforeEvent && crowd.vsUsual !== undefined && (
              <p className="mt-3 text-base font-bold text-gray-900">
                {Math.abs(crowd.vsUsual - 1) < 0.1
                  ? t("평소 이 시간과 비슷해요")
                  : t(crowd.vsUsual > 1 ? "평소 이 시간보다 {n}% 많아요" : "평소 이 시간보다 {n}% 적어요", {
                      n: Math.round(Math.abs(crowd.vsUsual - 1) * 100),
                    })}
              </p>
            )}
            {crowd.area && isOpen && !beforeEvent && (
              <p className="mt-1 text-sm text-gray-700">
                {t("{area} 전체 {min}~{max}명", {
                  area: areaLabel(crowd.area.name),
                  min: compactNumber(crowd.area.range[0], lang),
                  max: compactNumber(crowd.area.range[1], lang),
                })}
                <span className="ml-2 text-[11px] text-gray-600">{t("서울시 실측")}</span>
              </p>
            )}
            {crowd.parking && isOpen && !beforeEvent && (
              <p className="mt-1 text-sm text-gray-700">
                {t("{lot} {n}/{total}면 주차 중", {
                  lot: t(crowd.parking.label),
                  n: crowd.parking.occupied.toLocaleString(),
                  total: crowd.parking.total.toLocaleString(),
                })}
                <span className="ml-2 text-[11px] text-gray-600">{t("공공데이터 실측")}</span>
              </p>
            )}
            {band && isOpen && !beforeEvent && (
              <p className="mt-1 text-sm font-semibold">
                {crowd.area && <span className="font-normal text-gray-600">{t("주변 지역은")} </span>}
                <UsualBand band={band.band} weekend={weekend} t={t} />
              </p>
            )}
            {/* 갱신·출처·자료 등급: 흐리고 작게 (경수님 10/30: 흰 상자가 위의 중요한 정보보다 먼저 눈에 들어왔다) */}
            {/* 10/31 경수님 '줄내림이 나면 예쁘게': 한 줄에 몰아 쓰면 아무 데서나 끊겨서, 갱신·출처 한 줄 + 등급 한 줄(줄이 넘치면 글자 밑으로 맞춰 내림) */}
            <div className={`mt-3 space-y-0.5 text-[11px] leading-relaxed ${crowd.stale ? "font-semibold text-amber-700" : "text-gray-600"}`}>
              <p>
                <span className="whitespace-nowrap">{t("{age} 갱신", { age: fmtAge(crowd.ageMinutes, t) })}</span>
                {crowd.stale && <span className="whitespace-nowrap"> · {t("갱신 지연")}</span>} · <span className="whitespace-nowrap">{t(SOURCE_LABEL[crowd.source])}</span>
              </p>
              <p className="flex items-start gap-1.5">
                <span className="mt-px shrink-0 rounded bg-gray-200 px-1 py-px text-[10px] leading-none font-bold text-gray-500">{dataGrade(crowd)}</span>
                <span>
                  <span className="whitespace-nowrap">{t(GRADE_LABEL[dataGrade(crowd)])}</span>
                  {dataGrade(crowd) !== "A" && ` · ${t("인원은 정원 기준으로 환산한 추정치예요")}`}
                </span>
              </p>
            </div>
              <AlertFab
                placeId={place.id}
                placeName={t(place.name)}
                enabled={authEnabled && pushEnabled && !beforeEvent}
                character={categoryCharacter(place.category)}
              />
          </section>
          {/* 유료: SK텔레콤 실측 '지금 실제 인원' — 누를 때만 불러온다 (경수님 10/28) */}
          <LiveCountButton placeId={place.id} />
          {/* 유료: AI 여행 요약 (입장권·교통·볼거리·추천 + 이번 주 한산한 날, 경수님 10/28). AI 키(ANTHROPIC_API_KEY)가 들어오면 보인다 */}
          {tripBriefAi() && (
            <TripBrief
              placeId={place.id}
              calmLine={
                calmest.peakScore >= 60
                  ? t("이번 주는 {day}이 그나마 덜 붐벼요", { day: dayName(calmest.date, t, lang) })
                  : t("이번 주는 {day}이 가장 한산해요", { day: dayName(calmest.date, t, lang) })
              }
            />
          )}
          <Suspense fallback={null}>
            <NearbyChips lat={place.lat} lng={place.lng} lang={lang} exclude={[placeHref(place)]} className="mt-3" />
          </Suspense>

          <WeatherCard signals={signals} lang={lang} place={place} />
          {/* 가는 길 도로 상황 (국가교통정보센터): 늦게 와도 페이지는 먼저 */}
          <Suspense fallback={null}>
            <RoadSection lat={place.lat} lng={place.lng} lang={lang} />
          </Suspense>
          {isOpen && !beforeEvent && <CrowdReport placeId={place.id} askWait={["themepark", "waterpark", "ski", "indoor"].includes(place.category)} />}
        </div>

        <div className="lg:[&>*:first-child]:mt-0">
          {/* 놀이기구 대기 */}
          {crowd.zones && crowd.zones.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-extrabold tracking-tight">{t("지금 대기가 긴 놀이기구")}</h2>
              <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-100">
                {crowd.zones.slice(0, 8).map((z) => (
                  <li key={z.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t(z.label)}</span>
                    <b className="text-sm">{fmtMinutes(z.waitMin ?? 0, t)}</b>
                    <LevelBadge score={z.score} />
                  </li>
                ))}
              </ul>
              {/* 구역별 (레퍼런스: Queue-Times가 놀이기구를 구역별로 묶음). 구역을 아는 공원(에버랜드)만 */}
              {areas.length > 1 && (
                <details className="group mt-3 rounded-2xl border border-gray-100">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
                    {t("구역별로 보기")} <span className="text-gray-500 group-open:rotate-90">›</span>
                  </summary>
                  <div className="divide-y divide-gray-100 border-t border-gray-100">
                    {areas.map((a) => (
                      <div key={a.name} className="px-4 py-3">
                        <p className="flex items-center justify-between gap-3">
                          <b className="text-[15px]">{t(a.name)}</b>
                          <span className="text-sm text-gray-600">
                            {t("평균 {n}분", { n: a.avg })} · {t("{n}개 운영", { n: a.rides.length })}
                          </span>
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-600">
                          {a.rides.map((z) => `${t(z.label)} ${z.waitMin ?? 0}${t("분")}`).join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <p className="mt-2 text-xs text-gray-500">
                {crowd.source === "queue-times" ? (
                  <a href="https://queue-times.com/" target="_blank" rel="noopener" className="underline">
                    Powered by Queue-Times.com
                  </a>
                ) : (
                  "Powered by ThemeParks.wiki"
                )}{" "}
                · {t("운영 중에는 5분마다 가져와요")}
              </p>
            </section>
          )}

          {/* 이벤트 인원 예측 */}
          {dday !== null && (
            <section className="mt-6 rounded-3xl bg-gray-900 p-5 text-white">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 font-bold">
                  <Glyph e="🎯" className="h-5 w-5 text-indigo-500" /> {t("이벤트 당일 예측")}
                </h2>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-bold">
                  {isOngoingEvent(place) ? t("진행 중") : dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : t("종료")}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/60">
                {place.eventDate}
                {place.eventEndDate && place.eventEndDate !== place.eventDate && ` ~ ${place.eventEndDate}`}
                {place.info?.eventPlayTime && ` · ${place.info.eventPlayTime}`}
                {!place.ktoContent ? (
                  <DataTag kind="임의" className="text-violet-300!" />
                ) : (
                  place.info?.eventVerified === false && (
                    <>
                      <DataTag className="text-amber-300!" /> {t("작년 일정 기준")}
                    </>
                  )
                )}
              </p>
              {eventForecast && eventPeak && (
                <>
                  <p className="mt-4 text-sm">
                    {t("최대 {hour} 전후", { hour: formatHour(eventPeak.hour, lang) })}{" "}
                    <b>{fmtPeople(Math.round((place.capacity * eventPeak.score) / 100), t, lang)}</b>
                    <DataTag className="text-amber-300!" /> {t("예상")} ·{" "}
                    <span style={{ color: inkOf(levelOf(eventPeak.score).color) }}>{levelOf(eventPeak.score).label}</span>
                  </p>
                  <div className="mt-4 rounded-2xl bg-white p-3 text-gray-900">
                    <HourlyChart points={withPeople(place, eventForecast)} />
                  </div>
                </>
              )}
            </section>
          )}

          {/* 혼잡 예측: 오늘·이번 주·석 달 달력·판단 기준을 탭 하나로 + 크게 보기 (사용자 QA 10/22) */}
          <ForecastTabs
            title={t("언제 가면 한산할까")}
            tabs={[
              {
                id: "today",
                label: t("오늘"),
                body: (
                  <>
                    <div className="sector">
                      {isOpen && best && !closingSoon && (
                        <p className="text-xl leading-snug font-extrabold text-emerald-800">
                          <Glyph e="★" className="mr-1 h-5 w-5 text-amber-400" />
                          {t("{hour}쯤 가면 가장 한산해요", { hour: formatHour(best.hour, lang) })}
                          <span className="ml-1.5 align-middle text-sm font-bold whitespace-nowrap" style={{ color: inkOf(levelOf(best.score).color) }}>
                            {t("예상 {level}", { level: t(levelOf(best.score).label) })}
                          </span>
                        </p>
                      )}
                      {isOpen && upcoming.length > 0 ? (
                        <div className="sector-box mt-2 px-2.5 py-1">
                          <UpcomingHours hours={upcoming} bestHour={best?.hour} />
                        </div>
                      ) : (
                        <p className="text-[15px] font-medium text-gray-800">{isOpen ? noBestText : t("오늘 운영이 끝났어요.")}</p>
                      )}
                      {todayReasons.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {todayReasons.map((r) => (
                            <span key={r.k} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700">
                              {trReason(r, t)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-5 text-base font-extrabold">
                      {t("오늘 시간대별")}
                      {isEstimated(crowd) && <DataTag />}
                    </p>
                    <div className="mt-4">
                      <HourlyChart
                        points={hourly}
                        highlightHour={Math.floor(now.hour)}
                        aspect="3 / 1"
                        estimated={isEstimated(crowd)}
                      />
                    </div>
                  </>
                ),
                big: (
                  <>
                    <HourlyChart
                      points={hourly}
                      highlightHour={Math.floor(now.hour)}
                      estimated={isEstimated(crowd)}
                    />
                    <HourTable
                      nowHour={Math.floor(now.hour)}
                      rows={hourly
                        .filter((h) => h.hour >= place.hours[0] && h.hour < Math.min(24, place.hours[1]))
                        .map((h) => ({
                          hour: h.hour,
                          label: formatHour(h.hour, lang),
                          score: h.score,
                          value: h.people !== undefined ? fmtPeople(h.people, t, lang) : peopleText(h.score),
                          forecast: h.forecast,
                        }))}
                    />
                  </>
                ),
              },
              {
                id: "week",
                label: t("이번 주"),
                body: (
                  <>
                    <p className="mb-3 text-sm font-medium text-gray-700">{t("이번 주 시간대별 예상 혼잡 · 초록 칸이 한산해요")}</p>
                    <WeekHeatmap days={heatDays} nowHour={now.hour} />
                    <p className="mt-3 text-[15px] font-semibold">
                      {calmest.peakScore >= 60
                        ? t("이번 주는 {day}이 그나마 덜 붐벼요", { day: dayName(calmest.date, t, lang) })
                        : t("이번 주는 {day}이 가장 한산해요", { day: dayName(calmest.date, t, lang) })}{" "}
                      <LevelBadge score={calmest.peakScore} />
                    </p>
                    {/* 아래 막대 그래프(이번 주 다시 한 번 + 더보기 달력)는 위 히트맵·한 달 탭과 겹쳐 뺐다 (사용자 10/26). 날짜 알림 버튼만 남김 */}
                    <TripWatchButton placeId={place.id} date={calmest.date} enabled={authEnabled && pushEnabled} />
                  </>
                ),
              },
              {
                id: "month",
                label: t("한 달"),
                body: (
                  <>
                    <p className="mb-3 text-sm font-medium text-gray-700">{t("앞으로 5주, 날마다 가장 붐빌 때의 예상 단계예요. 날짜를 누르면 그날 이유가 보여요")}</p>
                    <MonthCalendar cells={calCells.slice(0, 35)} />
                  </>
                ),
                big: <MonthCalendar cells={calCells.slice(0, 35)} big />,
              },
              {
                id: "year",
                label: t("1년"),
                body: <YearOverview cells={calCells} />,
                big: <YearOverview cells={calCells} big />,
              },
              {
                id: "how",
                label: t("판단 기준"),
                body: <JudgementCard place={place} crowd={crowd} signals={signals} lang={lang} inline />,
              },
            ]}
          />
          <Link href={`/history/place/${place.id}`} className="mt-2 inline-block text-sm font-semibold text-indigo-600">
            {t("지난 날짜 실제 기록 보기")} ›
          </Link>

          {/* 입장권·숙소 칸: 혼잡 그래프 바로 아래 (10/28 경수님: 사이트 취지인 그래프가 위, 예약은 그 다음에 잘 보이게).
              외국어 화면은 모든 장소에 (외국인은 여행 먼저, 공항은 airport 화면에서 도착 필수품 칩), 오늘 혼잡 예측이면 '미리 사면 줄이 줄어요' */}
          {(lang !== "ko" || ["themepark", "waterpark", "ski", "landmark"].includes(place.category)) && (
            <TourLinks
              ko={place.name}
              en={getT("en")(place.name)}
              lang={lang}
              t={t}
              className="mt-8"
              busy={todayPeak.peakScore >= 60}
            />
          )}
          <StayLinks ko={place.name} en={getT("en")(place.name)} lang={lang} t={t} at={place} className="mt-4" />

          {signals.localPop && <VisitorProfile pop={signals.localPop} lang={lang} />}
          {/* 서울 장소: 주변 지역의 지금 성별·연령 (서울시 실시간) */}
          {!signals.localPop && seoulProfile && (
            <SeoulPeopleProfile
              profile={seoulProfile}
              lang={lang}
              areaName={areaLabel(place.seoulArea)}
              className="mt-8 rounded-3xl border border-gray-100 p-4"
            />
          )}

          <NearbyRail lat={place.lat} lng={place.lng} lang={lang} exclude={[placeHref(place)]} />
          <InlineAd className="mt-6" />

          <DroneVideos videos={videosFor(place.id)} className="mt-8" />
          <InlineAd className="mt-6" />

          {/* 함께 가면 좋은 곳 + 지금 덜 붐비는 근처 대안을 한 구역으로 (사용자 QA 10/22) */}
          {related.length === 0 ? (
            !beforeEvent && (
              <CalmAlternatives
                lat={place.lat}
                lng={place.lng}
                score={isOpen ? crowd.score : undefined}
                selfId={place.id}
                lang={lang}
                character={categoryCharacter(place.category)}
                className="sector mt-8"
              />
            )
          ) : (
            <section className="sector mt-8">
              <h2 className="text-xl font-extrabold tracking-tight">{t("함께 가면 좋은 곳")}</h2>
              {!beforeEvent && (
                <CalmAlternatives
                  lat={place.lat}
                  lng={place.lng}
                  score={isOpen ? crowd.score : undefined}
                  selfId={place.id}
                  lang={lang}
                  character={categoryCharacter(place.category)}
                  className="sector-box mt-3"
                />
              )}
              {related.length > 0 && (
                <>
                  <p className="mt-4 text-sm font-medium text-gray-700">
                    {t("이곳에 온 사람들이 같은 날 많이 들른 곳이에요. 붐빌 때 대신 가 보세요.")}
                  </p>
                  <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {relatedInfo.map((r) => {
                      const body = (
                        <>
                          <span className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-semibold">{relatedNames.get(r.name) ?? r.name}</span>
                            {r.score !== undefined && <LevelBadge score={r.score} />}
                          </span>
                          <span className="block truncate text-xs text-gray-500">
                            {t(r.category.split(" > ")[0])} · {relatedNames.get(r.region) ?? r.region}
                            {r.km !== undefined && <b className="text-gray-700"> · {t("여기서 {km}km", { km: r.km.toFixed(1) })}</b>}
                          </span>
                        </>
                      );
                      const cls = "block h-full rounded-2xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgb(15_23_42/0.05)]";
                      return (
                        <li key={r.name}>
                          {r.href ? (
                            <Link href={r.href} className={cls}>
                              {body}
                            </Link>
                          ) : (
                            <a
                              href={`https://map.naver.com/p/search/${encodeURIComponent(`${r.name} ${r.region}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className={cls}
                            >
                              {body}
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-xs text-gray-600">{t("한국관광공사 관광지별 연관 관광지 (티맵 이동 데이터)")}</p>
                </>
              )}
            </section>
          )}

          {/* 생성형 AI 검색이 인용하기 좋은 질문-답 (실시간 수치 + 기준 시각) */}
          <FaqBlock
            className="mt-8"
            title={t("자주 묻는 질문")}
            items={[
              {
                q: t("{name} 지금 붐비나요?", { name: t(place.name) }),
                a: isOpen
                  ? t("{time} 기준 {name}의 혼잡도는 '{level}'이에요. {detail}", {
                      time: basisTime,
                      name: t(place.name),
                      level: t(level.label),
                      detail: headcountInfo(crowd, { t, lang })?.text ?? t(level.desc),
                    })
                  : t("{name}은 지금 운영 시간이 아니에요. 운영 시간은 {from}~{to}예요.", {
                      name: t(place.name),
                      from: formatClock(place.hours[0]),
                      to: formatClock(place.hours[1]),
                    }),
              },
              {
                q: t("{name} 언제 가면 한산한가요?", { name: t(place.name) }),
                a: best
                  ? t("오늘은 {hour}가 가장 한산할 것으로 예상돼요 (예상 '{level}').", {
                      hour: formatHour(best.hour, lang),
                      level: t(levelOf(best.score).label),
                    })
                  : closingSoon
                    ? t("오늘은 입장 마감이 가까워요. 다음 방문은 아래 이번 주 예측을 참고하세요.")
                    : t("오늘 남은 운영 시간 중에는 지금이 가장 한산한 편이에요."),
              },
              ...(monthFaq ? [monthFaq] : []),
              {
                q: t("이 혼잡도 정보는 어디서 나오나요?"),
                // 갱신 주기는 실제 수집 주기(lib/crowd/cadence: 운영 중 놀이공원 5분·서울 10분·문 닫은 시간 30분) — 10/31 비교 점검: '10분' 고정 문구가 위 '5분마다'와 달랐다
                a: t("{source}를 바탕으로 CrowdView가 {n}분마다 갱신해요. 실제 현장과 다를 수 있어요.", { source: t(SOURCE_LABEL[crowd.source]), n: cadenceMinutes(place) }),
              },
            ]}
          />
          {/* 질문형 SEO 페이지로 내부 링크 (10/26: 검색로봇이 /crowd 161쪽을 홈·푸터에서만 발견해 뒤로 밀렸다) */}
          {crowdPage && (
            <p className="mt-4 text-sm">
              <Link href={`/crowd/${crowdPage.slug}`} className="font-semibold text-indigo-700">
                {t("{name} 지금 붐비나요?", { name: t(place.name) })} ›
              </Link>
            </p>
          )}

          {/* 최근 소식 (Brave·Tavily 뉴스 검색, 하루 한 번 — lib/trending) */}
          {news && news.hits.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-extrabold tracking-tight">{t("최근 소식")}</h2>
              {news.summary?.[lang] && (
                <p className="mt-3 rounded-2xl bg-indigo-50 px-4 py-3 text-[15px] leading-snug font-bold text-indigo-950">
                  <span className="mr-1.5 text-xs font-extrabold text-indigo-600">{t("지금 이슈")}</span>
                  {news.summary[lang]}
                </p>
              )}
              <ul className="sector mt-3 space-y-2 p-3">
                {news.hits.map((h) => (
                  <li key={h.url}>
                    <a href={h.url} target="_blank" rel="noreferrer" className="block rounded-2xl bg-white px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.06)]">
                      <p className="line-clamp-2 text-[15px] leading-snug font-bold text-gray-950">{newsTr.get(h.title) ?? h.title}</p>
                      <p className="mt-1 text-xs font-medium text-gray-600">
                        {h.source} ›
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-gray-500">{t(news.summary?.[lang] ? "뉴스 검색으로 하루 한 번 모으고, '지금 이슈'는 AI가 기사를 요약했어요. 내용은 각 기사에서 확인하세요." : "뉴스 검색으로 하루 한 번 모아요. 내용은 각 기사에서 확인하세요.")}</p>
            </section>
          )}

          {/* 정보 */}
          <section className="mt-8 mb-8 space-y-3 text-sm">
            <h2 className="text-xl font-extrabold tracking-tight">{t("정보")}</h2>
            <div className="flex gap-3">
              <span className="w-14 shrink-0 text-gray-500">{t("운영")}</span>
              <div className="min-w-0">
                <p>
                  {place.info?.closedToday
                    ? t("오늘 휴무")
                    : t("오늘 {from} ~ {to}", { from: formatClock(place.hours[0]), to: formatClock(place.hours[1]) })}
                  {!place.info?.closedToday && <LocalTime hour={place.hours[0]} to={place.hours[1]} />}{" "}
                  <span className={isOpen ? "text-emerald-700" : "text-gray-500"}>
                    {isOpen ? `· ${t("운영 중")}` : `· ${t(crowd.offSeason ? "시즌 아님" : "운영 종료")}`}
                  </span>
                  {!place.info?.hoursVerified && <DataTag kind="임의" />}
                  {place.info?.hoursSource === "google" && <span className="ml-1 text-xs text-gray-500">({t("Google 지도 기준")})</span>}
                </p>
                {hoursNote && (hoursNote.main || hoursNote.notes.length > 0) && (
                  <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-gray-500">{[hoursNote.main, ...hoursNote.notes].filter(Boolean).join("\n")}</p>
                )}
              </div>
            </div>
            {restNote && (
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-gray-500">{t("휴무")}</span>
                {/* 휴무 본문은 문의·주소와 같은 크기, ※ 안내는 아래 작은 회색 줄 (지인 QA 10/30) */}
                <div className="min-w-0">
                  {restNote.main && <p className="whitespace-pre-line">{restNote.main}</p>}
                  {restNote.notes.length > 0 && <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-gray-500">{restNote.notes.join("\n")}</p>}
                </div>
              </div>
            )}
            {/* 구글 지도 평점·리뷰 수·소개·편의 정보 (lib/google-facts). 구글 규정: 지도 밖에서 보여 줄 땐 'Google 지도' 출처를 바로 곁에 */}
            {g && (g.rating !== undefined || gSummary || !!g.amen?.length) && (
              <>
                {g.rating !== undefined && (
                  <div className="flex gap-3">
                    <span className="w-14 shrink-0 text-gray-500">{t("평점")}</span>
                    <span>
                      <span className="text-amber-500">★</span> {g.rating.toFixed(1)}
                      {g.count !== undefined && <span className="text-gray-500"> · {t("리뷰 {n}개", { n: compactNumber(g.count, lang) })}</span>}
                    </span>
                  </div>
                )}
                {gSummary && (
                  <div className="flex gap-3">
                    <span className="w-14 shrink-0 text-gray-500">{t("소개")}</span>
                    <span>{gSummary}</span>
                  </div>
                )}
                {!!g.amen?.length && (
                  <div className="flex gap-3">
                    <span className="w-14 shrink-0 text-gray-500">{t("편의")}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {g.amen.map((k) => (
                        <span key={k} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
                          {t(AMENITY_LABEL[k] ?? k)}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                <p className="pl-17 text-xs text-gray-500">
                  {t("평점·소개·편의 정보 출처")}{" "}
                  <a
                    href={g.uri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {t("Google 지도")}
                  </a>
                </p>
              </>
            )}
            {research && <ResearchFactsBlock f={research} lang={lang} t={t} text={(x) => researchTr?.get(x) ?? x} />}
            {place.info?.infocenter && (
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-gray-500">{t("문의")}</span>
                <span>{place.info.infocenter}</span>
              </div>
            )}
            {!place.info?.infocenter && g?.phone && (
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-gray-500">{t("문의")}</span>
                <a href={`tel:${g.phone.replace(/[^\d+]/g, "")}`}>{g.phone}</a>
              </div>
            )}
            {g?.web && /^https?:\/\//.test(g.web) && (
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-gray-500">{t("홈페이지")}</span>
                <a href={g.web} target="_blank" rel="noreferrer" className="min-w-0 truncate text-gray-700 underline underline-offset-2">
                  {g.web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </a>
              </div>
            )}
            <div className="flex gap-3">
              <span className="w-14 shrink-0 text-gray-500">{t("주소")}</span>
              <span>{address}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {place.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                  #{t(tag)}
                </span>
              ))}
            </div>
            {lang !== "ko" && <p className="pt-1 text-xs text-gray-500">{t("운영 시간·휴무·문의·주소는 한국어 원문이에요.")}</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
