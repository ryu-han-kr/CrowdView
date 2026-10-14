import { notFound, redirect } from "next/navigation";
import { HourlyChart } from "@/components/HourlyChart";
import { LevelBadge } from "@/components/Level";
import { PlaceHero } from "@/components/PlaceHero";
import { forecastForDate, forecastReasons, weekForecast } from "@/lib/crowd/model";
import { getSignals } from "@/lib/crowd/signals";
import { getCrowd } from "@/lib/crowd/service";
import { levelOf } from "@/lib/levels";
import { PLACES, getPlace, placeHref } from "@/lib/places";
import { daysUntil, formatAge, formatHour, kst } from "@/lib/time";
import type { CrowdResult, HourPoint } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;

const SOURCE_LABEL: Record<CrowdResult["source"], string> = {
  "seoul-citydata": "서울시 실시간 도시데이터",
  "incheon-airport": "인천국제공항공사 출국장 혼잡도",
  "kac-airport": "한국공항공사 공항 혼잡도",
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
  const place = getPlace(id);
  const crowd = await getCrowd(id);
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
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {isOpen ? (
              <>
                약 <b>{crowd.headcount.toLocaleString()}</b>명
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
              이번 주는 <b>{dayName(calmest.date)}</b>이 가장 한산해요 <LevelBadge score={calmest.peakScore} />
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

        {/* 이벤트 인원 예측 */}
        {dday !== null && (
          <section className="mt-6 rounded-3xl bg-gray-900 p-5 text-white">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">🎯 이벤트 당일 예측</h2>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-bold">
                {dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : "종료"}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/60">{place.eventDate} 개최 (샘플 일정)</p>
            {eventForecast && eventPeak && (
              <>
                <p className="mt-4 text-sm">
                  최대 <b>{formatHour(eventPeak.hour)}</b> 전후{" "}
                  <b>{Math.round((place.capacity * eventPeak.score) / 100).toLocaleString()}명</b> 예상 ·{" "}
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
          <h2 className="text-lg font-bold">오늘 시간대별</h2>
          <div className="mt-6">
            <HourlyChart points={crowd.hourly} highlightHour={Math.floor(now.hour)} />
          </div>
        </section>

        {/* 이번 주 */}
        <section className="mt-8">
          <h2 className="text-lg font-bold">이번 주</h2>
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

        {/* 정보 */}
        <section className="mt-8 mb-8 space-y-3 text-sm">
          <h2 className="text-lg font-bold">정보</h2>
          <div className="flex gap-3">
            <span className="w-14 shrink-0 text-gray-400">운영</span>
            <span>
              {formatHour(place.hours[0])} ~ {formatHour(place.hours[1])}{" "}
              <span className={isOpen ? "text-emerald-600" : "text-gray-400"}>{isOpen ? "· 운영 중" : "· 운영 종료"}</span>
            </span>
          </div>
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
