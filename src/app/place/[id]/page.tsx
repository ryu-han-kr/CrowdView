import { notFound } from "next/navigation";
import { HourlyChart } from "@/components/HourlyChart";
import { LevelBadge, LevelMeter, TrendArrow } from "@/components/Level";
import { PlaceHero } from "@/components/PlaceHero";
import { forecastForDate } from "@/lib/crowd/model";
import { getCrowd } from "@/lib/crowd/service";
import { levelOf } from "@/lib/levels";
import { getPlace } from "@/lib/places";
import { daysUntil, formatAge, formatHour, kst } from "@/lib/time";
import type { HourPoint } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

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
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">지금 혼잡도</p>
              <p className="mt-1 text-3xl font-extrabold" style={{ color: level.color }}>
                {level.label}
              </p>
              <p className="mt-1 text-sm text-gray-600">{level.desc}</p>
            </div>
            {isOpen && <LevelMeter score={crowd.score} className="scale-150 origin-top-right" />}
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            {isOpen && (
              <>
                <span>
                  추정 <b>{crowd.headcount.toLocaleString()}</b>명
                </span>
                <TrendArrow trend={crowd.trend} />
              </>
            )}
            <span className={`ml-auto text-xs ${crowd.stale ? "font-semibold text-amber-600" : "text-gray-400"}`}>
              {crowd.stale ? `⚠ ${formatAge(crowd.ageMinutes)} 데이터` : `${formatAge(crowd.ageMinutes)} 갱신`}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            출처: {crowd.source === "seoul-citydata" ? "서울시 실시간 도시데이터" : "CrowdView 예측 모델 (샘플)"}
          </p>
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

        {/* 시간대별 그래프 */}
        <section className="mt-6">
          <h2 className="text-lg font-bold">오늘 시간대별 혼잡도</h2>
          <div className="mt-6">
            <HourlyChart points={crowd.hourly} highlightHour={Math.floor(now.hour)} />
          </div>
        </section>

        {/* AI 추천 방문 시간 */}
        <section className="mt-6 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4">
          <p className="text-xs font-semibold text-indigo-500">✨ AI 방문 추천</p>
          {best ? (
            <p className="mt-1 text-sm">
              오늘 남은 시간 중 <b>{formatHour(best.hour)}</b>이 가장 한산할 것으로 예상돼요{" "}
              <LevelBadge score={best.score} />
            </p>
          ) : (
            <p className="mt-1 text-sm">
              {isOpen ? "오늘은 지금이 가장 한산한 편이에요." : "오늘 영업이 종료됐어요. 내일 오전 방문을 추천해요."}
            </p>
          )}
        </section>

        {/* 정보 */}
        <section className="mt-6 mb-8 space-y-3 text-sm">
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
