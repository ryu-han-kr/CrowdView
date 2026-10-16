import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { jsonLd, pageMeta, SITE } from "@/lib/seo";
import { HourlyChart } from "@/components/HourlyChart";
import { LevelBadge } from "@/components/Level";
import { PlaceHero } from "@/components/PlaceHero";
import { forecastForDate, forecastReasons, weekForecast } from "@/lib/crowd/model";
import { getHistory, type HistoryPoint } from "@/lib/crowd/history";
import { getSignals } from "@/lib/crowd/signals";
import { getCrowd } from "@/lib/crowd/service";
import { levelOf } from "@/lib/levels";
import { getLivePlace, isOngoingEvent } from "@/lib/place-info";
import { PLACES, placeHref } from "@/lib/places";
import { daysUntil, formatClock, kst } from "@/lib/time";
import type { Lang } from "@/i18n/config";
import { localePath } from "@/i18n/config";
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
import { pushEnabled } from "@/lib/alerts";
import { authEnabled } from "@/lib/auth";
import { headcountInfo, isEstimated } from "@/lib/format";
import { translateNames } from "@/lib/name-translate";
import { getRelatedPlaces } from "@/lib/related-places";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;

const SOURCE_LABEL: Record<CrowdResult["source"], string> = {
  "seoul-citydata": "서울시 실시간 도시데이터",
  "incheon-airport": "인천국제공항공사 출국장 혼잡도",
  "kac-airport": "한국공항공사 공항 혼잡도",
  "themeparks-wiki": "놀이기구 대기시간 · Powered by ThemeParks.wiki",
  model: "CrowdView 예측 모델 (샘플)",
};

// 빌드 때 장소별 페이지를 미리 만들어 두고, 이후엔 위 주기로 갱신한다
export function generateStaticParams() {
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
function bestUpcoming(points: HourPoint[], open: number, close: number): HourPoint | undefined {
  return points.filter((p) => p.forecast && p.hour >= open && p.hour < close).sort((a, b) => a.score - b.score)[0];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; lang: string }> }): Promise<Metadata> {
  const { id, lang } = await params;
  const place = PLACES.find((p) => p.id === id);
  if (!place) return {};
  const t = getT(lang);
  return pageMeta({
    lang,
    path: placeHref(place),
    title: t("{name} 실시간 혼잡도", { name: t(place.name) }),
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
  const relatedNames = await translateNames(related.flatMap((r) => [r.name, r.region]), lang);
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
        label: "운영 종료",
        desc: t("운영 시간 {from} ~ {to}", { from: formatHour(place.hours[0], lang), to: formatHour(place.hours[1], lang) }),
        color: "#6b7280",
      };
  const best = bestUpcoming(crowd.hourly, ...place.hours);
  const dday = place.eventDate ? daysUntil(place.eventDate) : null;
  const eventForecast = place.eventDate && dday !== null && dday > 0 ? forecastForDate(place, place.eventDate) : null;
  const eventPeak = eventForecast && [...eventForecast].sort((a, b) => b.score - a.score)[0];

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": place.category === "themepark" ? "AmusementPark" : place.category === "beach" ? "Beach" : "TouristAttraction",
            name: t(place.name),
            description: t(place.description),
            url: `${SITE}${localePath(lang, placeHref(place))}`,
            address: { "@type": "PostalAddress", streetAddress: place.address, addressCountry: "KR" },
            geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
            ...(place.image && { image: `${SITE}${place.image}` }),
          }),
        }}
      />
      <PlaceHero place={place} />

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

          {/* 현재 혼잡도 */}
          {/* 지금 혼잡도 */}
          <section className="mt-4 rounded-3xl px-4 py-3.5" style={{ background: `${level.color}14` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">{t("지금 혼잡도")}</p>
                <p className="text-2xl font-extrabold" style={{ color: level.color }}>
                  {t(level.label)}
                  {isOpen && isEstimated(crowd) && <DataTag className="text-xs" />}
                </p>
                <p className="text-sm text-gray-600">
                  {isOpen ? (
                    <>
                      {crowd.avgWaitMin !== undefined ? (
                        <>
                          {t("놀이기구 평균 대기")} <b>{fmtMinutes(crowd.avgWaitMin, t)}</b>
                        </>
                      ) : (
                        (headcountInfo(crowd, { t, lang })?.text ?? t(level.desc))
                      )}
                      {crowd.avgWaitMin === undefined && headcountInfo(crowd)?.kind && (
                        <DataTag kind={headcountInfo(crowd)!.kind} />
                      )}
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
              {t("{age} 갱신", { age: fmtAge(crowd.ageMinutes, t) })} · {t(SOURCE_LABEL[crowd.source])}
            </p>
          </section>

          <WeatherCard signals={signals} lang={lang} place={place} />
          <AlertButtons placeId={place.id} enabled={authEnabled && pushEnabled} />

        {/* 언제 가면 좋을까 */}
          <section className="mt-4 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4">
            <p className="text-xs font-semibold text-indigo-500">✨ {t("언제 가면 좋을까요?")}</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li>
                {best ? (
                  <>
                    {t("오늘은 {hour}가 가장 한산해요", { hour: formatHour(best.hour, lang) })} <LevelBadge score={best.score} />
                  </>
                ) : isOpen ? (
                  t("오늘은 지금이 가장 한산한 편이에요.")
                ) : (
                  t("오늘 운영이 끝났어요.")
                )}
              </li>
              <li>
                {calmest.peakScore >= 60
                  ? t("이번 주는 {day}이 그나마 덜 붐벼요", { day: dayName(calmest.date, t, lang) })
                  : t("이번 주는 {day}이 가장 한산해요", { day: dayName(calmest.date, t, lang) })}{" "}
                <LevelBadge score={calmest.peakScore} />
              </li>
            </ul>
            {todayReasons.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {todayReasons.map((r) => (
                  <span key={r.k} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-600">
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
                <h2 className="font-bold">🎯 {t("이벤트 당일 예측")}</h2>
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

          {/* 이번 주 */}
          <section className="mt-8">
            <h2 className="text-lg font-bold">
              {t("이번 주")}
              <DataTag />
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">{t("하루 중 가장 붐빌 때 기준 · 공휴일·날씨·관광공사 예측 반영")}</p>
            <ul className="mt-4 grid grid-cols-7 gap-1.5">
              {week.map((d) => {
                const lv = levelOf(d.peakScore);
                const isCalmest = d.date === calmest.date;
                return (
                  <li key={d.date} className="flex flex-col items-center">
                    <div className="flex h-20 w-full items-end rounded-lg bg-gray-50">
                      <div
                        className={`w-full rounded-lg ${isCalmest ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}
                        style={{
                          height: `${Math.max(8, d.peakScore)}%`,
                          background: lv.color,
                        }}
                        title={`${d.date} · ${t(lv.label)} · ${t("피크")} ${formatHour(d.peakHour, lang)}`}
                      />
                    </div>
                    <span className={`mt-1.5 text-xs ${isCalmest ? "font-bold text-emerald-600" : "font-medium"}`}>
                      {shortDay(d.date, t, lang)}
                    </span>
                    <span className="text-[10px] leading-tight" style={{ color: lv.color }}>
                      {t(lv.label)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {week.some((d) => d.reasons.length > 0) && (
              <ul className="mt-4 space-y-1 rounded-2xl bg-gray-50 p-3 text-xs text-gray-600">
                {week
                  .filter((d) => d.reasons.length > 0)
                  .map((d) => (
                    <li key={d.date}>
                      <b className="mr-1.5 text-gray-900">{dayName(d.date, t, lang)}</b>
                      {d.reasons.map((r) => trReason(r, t)).join(" · ")}
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {signals.localPop && <VisitorProfile pop={signals.localPop} lang={lang} />}

          <JudgementCard place={place} crowd={crowd} signals={signals} lang={lang} />
          <InlineAd className="mt-6" />

          {/* 함께 가면 좋은 곳 (관광공사 연관 관광지: 내비 이동 데이터) */}
          {related.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">{t("함께 가면 좋은 곳")}</h2>
              <p className="mt-0.5 text-xs text-gray-500">{t("이곳에 온 사람들이 같은 날 많이 들른 곳이에요. 붐빌 때 대신 가 보세요.")}</p>
              <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                {related.map((r) => (
                  <li key={r.name}>
                    <a
                      href={`https://map.naver.com/p/search/${encodeURIComponent(`${r.name} ${r.region}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-full rounded-2xl border border-gray-100 px-3 py-2.5"
                    >
                      <span className="block truncate text-sm font-semibold">{relatedNames.get(r.name) ?? r.name}</span>
                      <span className="block truncate text-[11px] text-gray-500">
                        {t(r.category.split(" > ")[0])} · {relatedNames.get(r.region) ?? r.region}
                      </span>
                    </a>
                  </li>
                ))}
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
                    : t("오늘 {from} ~ {to}", { from: formatClock(place.hours[0]), to: formatClock(place.hours[1]) })}{" "}
                  <span className={isOpen ? "text-emerald-600" : "text-gray-400"}>
                    {isOpen ? `· ${t("운영 중")}` : `· ${t("운영 종료")}`}
                  </span>
                  {!place.info?.hoursVerified && <DataTag kind="임의" />}
                </p>
                {place.info?.hoursText && (
                  <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-gray-500">
                    {place.info.hoursText}
                  </p>
                )}
              </div>
            </div>
            {place.info?.restText && (
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-gray-400">{t("휴무")}</span>
                <span className="text-xs leading-relaxed text-gray-600">{place.info.restText}</span>
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
