import { notFound, redirect } from "next/navigation";
import { StayLinks } from "@/components/StayLinks";
import type { Metadata } from "next";
import placeImages from "@/data/korea/place-images.json";
import { breadcrumbLd, jsonLd, kstClock, pageMeta, SITE } from "@/lib/seo";
import { HourlyChart } from "@/components/HourlyChart";
import { LevelBadge } from "@/components/Level";
import { PlaceHero } from "@/components/PlaceHero";
import { forecastForDate, forecastReasons, weekForecast } from "@/lib/crowd/model";
import { UpcomingHours, WeekForecast } from "@/components/PlaceForecast";
import { getHistory, type HistoryPoint } from "@/lib/crowd/history";
import { getSignals } from "@/lib/crowd/signals";
import { getCrowd } from "@/lib/crowd/service";
import { levelOf } from "@/lib/levels";
import { getLivePlace, isOngoingEvent } from "@/lib/place-info";
import { PLACES, placeHref } from "@/lib/places";
import { daysUntil, formatClock, kst } from "@/lib/time";
import type { Lang } from "@/i18n/config";
import { DEFAULT_LANG, localePath } from "@/i18n/config";
import { fmtAge, fmtMinutes, fmtPeople, trReason } from "@/i18n/patterns";
import { getT } from "@/i18n/server";
import { formatHour, type T } from "@/i18n/translate";
import type { CrowdResult, HourPoint } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";
import { DataTag } from "@/components/DataTag";
import { FavoriteButton } from "@/components/FavoriteButton";
import { JudgementCard } from "@/components/JudgementCard";
import { VisitorProfile } from "@/components/VisitorProfile";
import { WeatherCard } from "@/components/WeatherCard";
import { InlineAd } from "@/components/AdUnit";
import { FaqBlock } from "@/components/FaqBlock";
import { AlertButtons } from "@/components/AlertButtons";
import { CalmAlternatives } from "@/components/CalmAlternatives";
import { pushEnabled } from "@/lib/alerts";
import { authEnabled } from "@/lib/auth";
import { headcountInfo, isEstimated } from "@/lib/format";
import { translateNames } from "@/lib/name-translate";
import { getRelatedPlaces } from "@/lib/related-places";
import { locateByName } from "@/lib/related-geo";
import { distanceKm } from "@/lib/geo";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { getAllSeoulLive } from "@/lib/seoul-live";
import Link from "@/i18n/link";
import { KstNote, LocalTime } from "@/components/LocalTime";
import { Glyph } from "@/components/Glyph";

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
  model: "CrowdView 추정 (요일·시간·날씨 패턴)",
};

// 빌드 때 장소별 페이지를 미리 만들어 두고, 이후엔 위 주기로 갱신한다
// 빌드 때는 한국어만 미리 만들고 다른 언어는 처음 열 때 만든다 (빌드 페이지 약 1,300개 → 500개 아래, Vercel 빌드 시간 절약)
export function generateStaticParams({ params }: { params: { lang: string } }) {
  if (params.lang !== DEFAULT_LANG) return [];
  return PLACES.map((p) => ({ id: p.id }));
}

const weekday = (date: string, lang: Lang, style: "long" | "short") =>
  new Intl.DateTimeFormat(lang, { weekday: style, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
function dayName(date: string, t: T, lang: Lang): string {
  const diff = daysUntil(date);
  if (diff === 0) return t("오늘");
  if (diff === 1) return t("내일");
  return weekday(date, lang, "long");
}

/** 예측 곡선의 지난 시간을 실측 기록으로 바꾼다. withPeople: 기록의 인원이 실제 인원일 때 */
function withRecordedHours(points: HourPoint[], records: HistoryPoint[], withPeople: boolean): HourPoint[] {
  const byHour = new Map<number, HistoryPoint>();
  for (const r of records) byHour.set(Math.floor(kst(new Date(r.t)).hour), r);
  return points.map((p) => {
    const r = !p.forecast ? byHour.get(p.hour) : undefined;
    if (!r) return p;
    return withPeople ? { ...p, score: r.score, people: r.headcount, peopleKind: "real" } : { ...p, score: r.score };
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
    // 실측 데이터가 없는 곳은 제목에도 '예측'이라고 쓴다
    title:
      place.seoulArea || place.themeparksId || place.airport
        ? t("{name} 실시간 혼잡도", { name: t(place.name) })
        : t("{name} 혼잡 예측·방문 추천 시간", { name: t(place.name) }),
    description: t("{name} 지금 혼잡도와 오늘 시간대별 예측, 언제 가면 한산한지 알려드려요", { name: t(place.name) }),
    image: place.image,
  });
}

export default async function PlacePage({ params }: { params: Promise<{ id: string; lang: string }> }) {
  const { id } = await params;
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  // 운영 시간·행사 일정은 한국관광공사 TourAPI 값 (없으면 places.ts의 임의 값)
  const [place, crowd] = await Promise.all([getLivePlace(id), getCrowd(id)]);
  if (!place || !crowd) notFound();
  if (place.category === "airport") redirect(localePath(lang, placeHref(place)));
  const [signals, [today], related] = await Promise.all([getSignals(place), getHistory(id, 1), getRelatedPlaces(place)]);
  const relatedNames = await translateNames(
    related.flatMap((r) => [r.name, r.region]),
    lang,
  );
  // 운영 시간·휴무 안내(관광공사 한국어 글)도 외국어 화면에서는 번역 (Papago 캐시). 번역기는 줄 단위라 줄바꿈을 ' / '로 펴서 보낸다
  const flat = (x?: string) => x?.replace(/\s*\n+\s*/g, " / ").trim();
  const infoTr = await translateNames([flat(place.info?.hoursText), flat(place.info?.restText)], lang);
  const trInfo = (x?: string) => (x ? (infoTr.get(flat(x)!) ?? x) : x);
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
  // 오늘 지난 시간은 10분마다 쌓은 실측 기록으로 채운다 (시간마다 마지막 기록)
  const hourly = withRecordedHours(crowd.hourly, today.points, crowd.source !== "model" && place.criteria?.unit === "명");
  const week = weekForecast(place, signals);
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
    .map((p) => ({ hour: p.hour, label: formatHour(p.hour, lang), score: p.score }));
  // 더보기: 앞으로 30일 달력 · 12개월 월평균 (가장 붐빌 때 기준, 추정)
  const long = weekForecast(place, signals, 365);
  const monthCells = long.slice(0, 30).map((d) => ({
    date: d.date,
    day: Number(d.date.slice(8, 10)),
    dow: new Date(`${d.date}T00:00:00Z`).getUTCDay(),
    peakScore: d.peakScore,
  }));
  // 12개월: 가장 붐빌 때는 달마다 비슷하게 꽉 차서, 운영 시간 평균 혼잡으로 비교한다 (사흘에 하루씩 표본)
  const byMonth = new Map<string, number[]>();
  for (const [i, d] of long.entries()) {
    if (i % 3) continue;
    const open = forecastForDate(place, d.date).filter((p) => p.hour >= place.hours[0] && p.hour < Math.min(24, place.hours[1]));
    if (!open.length) continue;
    const mean = open.reduce((a, p) => a + p.score, 0) / open.length;
    byMonth.set(d.date.slice(0, 7), [...(byMonth.get(d.date.slice(0, 7)) ?? []), mean]);
  }
  const yearBars = [...byMonth.entries()].slice(0, 12).map(([ym, xs]) => ({
    label: new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" }).format(new Date(`${ym}-15T00:00:00Z`)),
    avg: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length),
  }));
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
      <PlaceHero place={place} gallery={PLACE_IMAGES[place.id] ?? []} />

      {/* 모바일: 한 줄로 쌓기 / PC: 왼쪽(지금·언제 갈까) 고정 + 오른쪽(그래프·정보) */}
      <div className="relative -mt-6 px-5 md:mt-8 md:px-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-10">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-medium text-gray-500">
            {t(CATEGORY_LABEL[place.category])} · {t(place.region)}
          </p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">{t(place.name)}</h1>
            <FavoriteButton placeId={place.id} className="hidden shrink-0 md:inline-flex" />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{t(place.description)}</p>
          {/* 한 문장 요약: 사람과 AI 검색이 바로 인용할 수 있게 (단계·출처·기준 시각) */}
          <p className="mt-2 text-[13px] leading-relaxed text-gray-800">
            {beforeEvent
              ? t("{name}은(는) {date}에 열려요. 아직 행사 전이라 지금 혼잡도 대신 행사 당일 예측을 보여드려요.", {
                  name: t(place.name),
                  date: place.eventDate!,
                })
              : !isOpen
                ? t("{name}은(는) 지금 운영 시간이 아니에요.", { name: t(place.name) })
                : t("{name}의 지금 혼잡도는 ‘{level}’이에요 ({source}, {time} 기준).", {
                    name: t(place.name),
                    level: t(level.label),
                    source: t(SOURCE_LABEL[crowd.source]),
                    time: crowd.observedAt ? crowd.observedAt.slice(11, 16) : kstClock(crowd.updatedAt),
                  })}
            {!beforeEvent &&
              best &&
              ` ${t("오늘 남은 운영 시간 중에는 {hour}쯤이 가장 한산할 것으로 보여요.", { hour: formatHour(best.hour, lang) })}`}
            {!beforeEvent && best && <LocalTime hour={best.hour} />}
          </p>
          <KstNote className="mt-1" />

          {/* 현재 혼잡도 */}
          {/* 지금 혼잡도 */}
          <section className="mt-4 rounded-3xl px-4 py-3.5" style={{ background: `${level.color}14` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">{beforeEvent ? t("행사 정보") : t("지금 혼잡도")}</p>
                <p className="text-2xl font-extrabold" style={beforeEvent ? undefined : { color: level.color }}>
                  {beforeEvent ? `${t("행사 전")} · D-${dday}` : t(level.label)}
                  {!beforeEvent && isOpen && isEstimated(crowd) && <DataTag className="text-xs" />}
                </p>
                <p className="text-sm text-gray-600">
                  {beforeEvent ? (
                    t("아직 행사가 열리지 않았어요. 행사 당일 예상 혼잡은 아래에서 확인하세요.")
                  ) : isOpen ? (
                    <>
                      {crowd.avgWaitMin !== undefined ? (
                        <>
                          {t("놀이기구 평균 대기")} <b>{fmtMinutes(crowd.avgWaitMin, t)}</b>
                        </>
                      ) : (
                        (headcountInfo(crowd, { t, lang })?.text ?? t(level.desc))
                      )}
                      {crowd.avgWaitMin === undefined && headcountInfo(crowd)?.kind && <DataTag kind={headcountInfo(crowd)!.kind} />}
                      {crowd.trend === "up" && <span className="text-red-500"> · {t("늘어나는 중")}</span>}
                      {crowd.trend === "down" && <span className="text-emerald-600"> · {t("줄어드는 중")}</span>}
                    </>
                  ) : (
                    t(level.desc)
                  )}
                </p>
              </div>
            </div>
            <p className={`mt-2 text-[11px] ${crowd.stale ? "font-semibold text-amber-600" : "text-gray-400"}`}>
              {t("{age} 갱신", { age: fmtAge(crowd.ageMinutes, t) })}
              {crowd.stale && <> · {t("갱신 지연")}</>} · {t(SOURCE_LABEL[crowd.source])}
            </p>
          </section>

          <WeatherCard signals={signals} lang={lang} place={place} />
          <AlertButtons placeId={place.id} enabled={authEnabled && pushEnabled} />
          {!beforeEvent && (
            <CalmAlternatives lat={place.lat} lng={place.lng} score={isOpen ? crowd.score : undefined} selfId={place.id} lang={lang} />
          )}

          {/* 앞으로 시간대별 (지금 이후, 입장 가능한 시간까지) */}
          <section className="card mt-4">
            <p className="text-xs font-semibold text-indigo-500">
              <Glyph e="✨" /> {t("지금 이후 시간대별 예상")}
            </p>
            {isOpen && upcoming.length > 0 ? (
              <UpcomingHours hours={upcoming} bestHour={best?.hour} />
            ) : (
              <p className="mt-2 text-sm text-gray-700">{isOpen ? noBestText : t("오늘 운영이 끝났어요.")}</p>
            )}
            <p className="mt-2 text-sm">
              {calmest.peakScore >= 60
                ? t("이번 주는 {day}이 그나마 덜 붐벼요", { day: dayName(calmest.date, t, lang) })
                : t("이번 주는 {day}이 가장 한산해요", { day: dayName(calmest.date, t, lang) })}{" "}
              <LevelBadge score={calmest.peakScore} />
            </p>
            {todayReasons.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {todayReasons.map((r) => (
                  <span key={r.k} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                    {trReason(r, t)}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="lg:[&>*:first-child]:mt-0">
          {/* 놀이기구 대기 */}
          {crowd.zones && crowd.zones.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">{t("지금 대기가 긴 놀이기구")}</h2>
              <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-100">
                {crowd.zones.map((z) => (
                  <li key={z.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t(z.label)}</span>
                    <b className="text-sm">{fmtMinutes(z.waitMin ?? 0, t)}</b>
                    <LevelBadge score={z.score} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-gray-400">Powered by ThemeParks.wiki · {t("5분 단위 갱신")}</p>
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
                    <span style={{ color: levelOf(eventPeak.score).color }}>{levelOf(eventPeak.score).label}</span>
                  </p>
                  <div className="mt-4 rounded-2xl bg-white p-3 text-gray-900">
                    <HourlyChart points={eventForecast} />
                  </div>
                </>
              )}
            </section>
          )}

          {/* 오늘 시간대별 */}
          <section className="mt-8">
            <h2 className="text-lg font-bold">
              {t("오늘 시간대별")}
              {isEstimated(crowd) && <DataTag />}
            </h2>
            <div className="mt-6">
              <HourlyChart
                points={hourly}
                highlightHour={Math.floor(now.hour)}
                estimated={isEstimated(crowd)}
                unit={place.criteria?.unit === "분" ? "분" : "명"}
              />
            </div>
          </section>

          {/* 이번 주 (막대를 누르면 그날) + 더보기: 30일·12개월 */}
          <section className="mt-8">
            <WeekForecast
              week={week.map((d) => ({
                date: d.date,
                short: shortDay(d.date, t, lang),
                long: `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))} (${weekday(d.date, lang, "short")})`,
                peakScore: d.peakScore,
                peakLabel: formatHour(d.peakHour, lang),
                reasons: d.reasons.map((r) => trReason(r, t)),
              }))}
              month={monthCells}
              year={yearBars}
              calmestDate={calmest.date}
            />
          </section>

          {signals.localPop && <VisitorProfile pop={signals.localPop} lang={lang} />}

          <JudgementCard place={place} crowd={crowd} signals={signals} lang={lang} />
          <StayLinks ko={place.name} en={getT("en")(place.name)} lang={lang} t={t} at={place} className="mt-6" />
          <InlineAd className="mt-6" />

          {/* 함께 가면 좋은 곳 (관광공사 연관 관광지: 내비 이동 데이터) */}
          {related.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">{t("함께 가면 좋은 곳")}</h2>
              <p className="mt-0.5 text-xs text-gray-500">{t("이곳에 온 사람들이 같은 날 많이 들른 곳이에요. 붐빌 때 대신 가 보세요.")}</p>
              <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                {relatedInfo.map((r) => {
                  const body = (
                    <>
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold">{relatedNames.get(r.name) ?? r.name}</span>
                        {r.score !== undefined && <LevelBadge score={r.score} />}
                      </span>
                      <span className="block truncate text-[11px] text-gray-500">
                        {t(r.category.split(" > ")[0])} · {relatedNames.get(r.region) ?? r.region}
                        {r.km !== undefined && <b className="text-gray-700"> · {t("여기서 {km}km", { km: r.km.toFixed(1) })}</b>}
                      </span>
                    </>
                  );
                  const cls = "block h-full rounded-2xl border border-gray-100 bg-white px-3 py-2.5";
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
              <p className="mt-2 text-[11px] text-gray-400">{t("한국관광공사 관광지별 연관 관광지 (티맵 이동 데이터)")}</p>
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
                      time: formatClock(kst().hour),
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
              {
                q: t("이 혼잡도 정보는 어디서 나오나요?"),
                a: t("{source}를 바탕으로 CrowdView가 10분마다 갱신해요. 실제 현장과 다를 수 있어요.", { source: t(SOURCE_LABEL[crowd.source]) }),
              },
            ]}
          />

          {/* 정보 */}
          <section className="mt-8 mb-8 space-y-3 text-sm">
            <h2 className="text-lg font-bold">{t("정보")}</h2>
            <div className="flex gap-3">
              <span className="w-14 shrink-0 text-gray-400">{t("운영")}</span>
              <div className="min-w-0">
                <p>
                  {place.info?.closedToday
                    ? t("오늘 휴무")
                    : t("오늘 {from} ~ {to}", { from: formatClock(place.hours[0]), to: formatClock(place.hours[1]) })}
                  {!place.info?.closedToday && <LocalTime hour={place.hours[0]} to={place.hours[1]} />}{" "}
                  <span className={isOpen ? "text-emerald-600" : "text-gray-400"}>
                    {isOpen ? `· ${t("운영 중")}` : `· ${t(crowd.offSeason ? "시즌 아님" : "운영 종료")}`}
                  </span>
                  {!place.info?.hoursVerified && <DataTag kind="임의" />}
                </p>
                {place.info?.hoursText && (
                  <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-gray-500">{trInfo(place.info.hoursText)}</p>
                )}
              </div>
            </div>
            {place.info?.restText && (
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-gray-400">{t("휴무")}</span>
                <span className="text-xs leading-relaxed text-gray-600">{trInfo(place.info.restText)}</span>
              </div>
            )}
            {place.info?.infocenter && (
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-gray-400">{t("문의")}</span>
                <span>{place.info.infocenter}</span>
              </div>
            )}
            <div className="flex gap-3">
              <span className="w-14 shrink-0 text-gray-400">{t("주소")}</span>
              <span>{place.address}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {place.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                  #{t(tag)}
                </span>
              ))}
            </div>
            {lang !== "ko" && <p className="pt-1 text-[11px] text-gray-400">{t("운영 시간·휴무·문의·주소는 한국어 원문이에요.")}</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
