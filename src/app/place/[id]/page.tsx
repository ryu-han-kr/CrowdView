import { notFound, redirect } from "next/navigation";
import { HourlyChart } from "@/components/HourlyChart";
import { LevelBadge } from "@/components/Level";
import { PlaceHero } from "@/components/PlaceHero";
import { forecastForDate, forecastReasons, weekForecast } from "@/lib/crowd/model";
import { getSignals } from "@/lib/crowd/signals";
import { getCrowd } from "@/lib/crowd/service";
import { levelOf } from "@/lib/levels";
import { getLivePlace, isOngoingEvent } from "@/lib/place-info";
import { PLACES, placeHref } from "@/lib/places";
import { daysUntil, formatAge, formatClock, formatHour, kst } from "@/lib/time";
import type { CrowdResult, HourPoint } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";
import { DataTag } from "@/components/DataTag";
import { VisitorProfile } from "@/components/VisitorProfile";
import { headcountInfo, isEstimated } from "@/lib/format";

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

const WEEKDAYS = "일월화수목금토";
function dayName(date: string): string {
  const diff = daysUntil(date);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  return `${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]}요일`;
}

/** 오늘·내일·수 */
function shortDay(date: string): string {
  const diff = daysUntil(date);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** 영업시간 내 앞으로 가장 한산한 시간 */
function bestUpcoming(points: HourPoint[], open: number, close: number): HourPoint | undefined {
  return points
    .filter((p) => p.forecast && p.hour >= open && p.hour < close)
    .sort((a, b) => a.score - b.score)[0];
}

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 운영 시간·행사 일정은 한국관광공사 TourAPI 값 (없으면 places.ts의 임의 값)
  const [place, crowd] = await Promise.all([getLivePlace(id), getCrowd(id)]);
  if (!place || !crowd) notFound();
  if (place.category === "airport") redirect(placeHref(place));
  const signals = await getSignals(place);
  const week = weekForecast(place, signals);
  const calmest = week.reduce((a, b) => (b.peakScore < a.peakScore ? b : a));
  const todayPeak = week[0];
  const todayReasons = forecastReasons(place, todayPeak.date, todayPeak.peakHour + 0.5, signals);

  const now = kst();
  const isOpen = crowd.open;
  const level = isOpen
    ? levelOf(crowd.score)
    : { label: "운영 종료", desc: `운영 시간 ${formatHour(place.hours[0])} ~ ${formatHour(place.hours[1])}`, color: "#6b7280" };
  const best = bestUpcoming(crowd.hourly, ...place.hours);
  const dday = place.eventDate ? daysUntil(place.eventDate) : null;
  const eventForecast = place.eventDate && dday !== null && dday > 0 ? forecastForDate(place, place.eventDate) : null;
  const eventPeak = eventForecast && [...eventForecast].sort((a, b) => b.score - a.score)[0];

  return (
    <main>
      <PlaceHero place={place} />

      <div className="relative -mt-6 px-5">
        <p className="text-xs font-medium text-gray-500">
          {CATEGORY_LABEL[place.category]} · {place.region}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{place.name}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{place.description}</p>

        {/* 현재 혼잡도 */}
        <section className="mt-5 rounded-3xl p-5" style={{ background: `${level.color}14` }}>
          <p className="text-xs font-medium text-gray-500">지금 혼잡도</p>
          <p className="mt-1 text-3xl font-extrabold" style={{ color: level.color }}>
            {level.label}
            {isOpen && isEstimated(crowd) && <DataTag className="text-xs" />}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {isOpen ? (
              <>
                {crowd.avgWaitMin !== undefined ? (
                  <>
                    놀이기구 평균 대기 <b>{crowd.avgWaitMin}분</b>
                  </>
                ) : (
                  (headcountInfo(crowd)?.text ?? level.desc)
                )}
                {crowd.avgWaitMin === undefined && headcountInfo(crowd)?.kind && <DataTag kind={headcountInfo(crowd)!.kind} />}
                {crowd.trend === "up" && <span className="text-red-500"> · 늘어나는 중</span>}
                {crowd.trend === "down" && <span className="text-emerald-600"> · 줄어드는 중</span>}
              </>
            ) : (
              level.desc
            )}
          </p>
          <p className={`mt-3 text-[11px] ${crowd.stale ? "font-semibold text-amber-600" : "text-gray-400"}`}>
            {formatAge(crowd.ageMinutes)} 갱신 · {SOURCE_LABEL[crowd.source]}
          </p>
        </section>

        {/* 언제 가면 좋을까 */}
        <section className="mt-4 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4">
          <p className="text-xs font-semibold text-indigo-500">✨ 언제 가면 좋을까요?</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              {best ? (
                <>
                  오늘은 <b>{formatHour(best.hour)}</b>이 가장 한산해요 <LevelBadge score={best.score} />
                </>
              ) : isOpen ? (
                "오늘은 지금이 가장 한산한 편이에요."
              ) : (
                "오늘 운영이 끝났어요."
              )}
            </li>
            <li>
              이번 주는 <b>{dayName(calmest.date)}</b>이 {calmest.peakScore >= 60 ? "그나마 덜 붐벼요" : "가장 한산해요"}{" "}
              <LevelBadge score={calmest.peakScore} />
            </li>
          </ul>
          {todayReasons.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {todayReasons.map((r) => (
                <span key={r} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-600">
                  {r}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 놀이기구 대기 */}
        {crowd.zones && crowd.zones.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">지금 대기가 긴 놀이기구</h2>
            <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {crowd.zones.map((z) => (
                <li key={z.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{z.label}</span>
                  <b className="text-sm">{z.waitMin}분</b>
                  <LevelBadge score={z.score} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-gray-400">Powered by ThemeParks.wiki · 5분 단위 갱신</p>
          </section>
        )}

        {/* 이벤트 인원 예측 */}
        {dday !== null && (
          <section className="mt-6 rounded-3xl bg-gray-900 p-5 text-white">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">🎯 이벤트 당일 예측</h2>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-bold">
                {isOngoingEvent(place) ? "진행 중" : dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : "종료"}
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
                    <DataTag className="text-amber-300!" /> 작년 일정 기준
                  </>
                )
              )}
            </p>
            {eventForecast && eventPeak && (
              <>
                <p className="mt-4 text-sm">
                  최대 <b>{formatHour(eventPeak.hour)}</b> 전후{" "}
                  <b>{Math.round((place.capacity * eventPeak.score) / 100).toLocaleString()}명</b>
                  <DataTag className="text-amber-300!" /> 예상 ·{" "}
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
            오늘 시간대별
            {isEstimated(crowd) && <DataTag />}
          </h2>
          <div className="mt-6">
            <HourlyChart points={crowd.hourly} highlightHour={Math.floor(now.hour)} estimated={isEstimated(crowd)} />
          </div>
        </section>

        {/* 이번 주 */}
        <section className="mt-8">
          <h2 className="text-lg font-bold">
            이번 주
            <DataTag />
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">하루 중 가장 붐빌 때 기준 · 공휴일·날씨·관광공사 예측 반영</p>
          <ul className="mt-4 grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              const lv = levelOf(d.peakScore);
              const isCalmest = d.date === calmest.date;
              return (
                <li key={d.date} className="flex flex-col items-center">
                  <div className="flex h-20 w-full items-end rounded-lg bg-gray-50">
                    <div
                      className={`w-full rounded-lg ${isCalmest ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}
                      style={{ height: `${Math.max(8, d.peakScore)}%`, background: lv.color }}
                      title={`${d.date} · ${lv.label} · 피크 ${formatHour(d.peakHour)}`}
                    />
                  </div>
                  <span className={`mt-1.5 text-xs ${isCalmest ? "font-bold text-emerald-600" : "font-medium"}`}>
                    {shortDay(d.date)}
                  </span>
                  <span className="text-[10px] leading-tight" style={{ color: lv.color }}>
                    {lv.label.replace("매우 ", "매우")}
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
                    <b className="mr-1.5 text-gray-900">{dayName(d.date)}</b>
                    {d.reasons.join(" · ")}
                  </li>
                ))}
            </ul>
          )}
        </section>

        {signals.localPop && <VisitorProfile pop={signals.localPop} />}

        {/* 정보 */}
        <section className="mt-8 mb-8 space-y-3 text-sm">
          <h2 className="text-lg font-bold">정보</h2>
          <div className="flex gap-3">
            <span className="w-14 shrink-0 text-gray-400">운영</span>
            <div className="min-w-0">
              <p>
                {place.info?.closedToday ? "오늘 휴무" : `오늘 ${formatClock(place.hours[0])} ~ ${formatClock(place.hours[1])}`}{" "}
                <span className={isOpen ? "text-emerald-600" : "text-gray-400"}>{isOpen ? "· 운영 중" : "· 운영 종료"}</span>
                {!place.info?.hoursVerified && <DataTag kind="임의" />}
              </p>
              {place.info?.hoursText && (
                <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-gray-500">{place.info.hoursText}</p>
              )}
            </div>
          </div>
          {place.info?.restText && (
            <div className="flex gap-3">
              <span className="w-14 shrink-0 text-gray-400">휴무</span>
              <span className="text-xs leading-relaxed text-gray-600">{place.info.restText}</span>
            </div>
          )}
          {place.info?.infocenter && (
            <div className="flex gap-3">
              <span className="w-14 shrink-0 text-gray-400">문의</span>
              <span>{place.info.infocenter}</span>
            </div>
          )}
          <div className="flex gap-3">
            <span className="w-14 shrink-0 text-gray-400">주소</span>
            <span>{place.address}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {place.tags.map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                #{t}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
