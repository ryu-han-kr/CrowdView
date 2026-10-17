import { OUTDOOR } from "@/lib/crowd/model";
import type { Signals } from "@/lib/crowd/signals";
import { LEVELS } from "@/lib/levels";
import { compactNumber } from "@/lib/format";
import { DataTag } from "./DataTag";
import { formatClock } from "@/lib/time";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import type { CrowdResult, Place } from "@/lib/types";


const LIVE: Partial<Record<CrowdResult["source"], string>> = {
  "seoul-citydata": "서울시 실시간 도시데이터 (통신 기반 인구, 5분 단위)",
  "incheon-airport": "인천국제공항공사 출국장 대기시간·인원 (1분 단위)",
  "kac-airport": "한국공항공사 구간별 혼잡도 (체크인~탑승)",
  "themeparks-wiki": "놀이기구 대기시간 평균 (ThemeParks.wiki, 5분 단위)",
};

/** "이 혼잡도는 어떻게 판단하나요?" — 장소마다 실제로 쓰인 데이터와 보정 요소를 보여준다 */
export function JudgementCard({
  place,
  crowd,
  signals,
  lang,
}: {
  place: Place;
  crowd: CrowdResult;
  signals: Signals;
  lang: Lang;
}) {
  const t = getT(lang);
  const outdoor = Math.round((place.outdoor ?? OUTDOOR[place.category]) * 100);
  const live = LIVE[crowd.source] && t(LIVE[crowd.source]!);
  const items: { ok: boolean; title: string; desc: string }[] = [
    {
      ok: !!live,
      title: live ? t("지금 혼잡도: 실측") : t("지금 혼잡도: 추정"),
      desc: live ?? t("이 장소는 실시간 데이터가 없어 아래 요소로 계산한 예측값이에요."),
    },
    {
      ok: !!(signals.localPop || signals.pax),
      title: t("시간대 패턴"),
      desc: signals.localPop
        ? t("부산시 생활인구(통신데이터) 같은 달 평균 방문인구")
        : signals.pax
          ? t("공항공사가 예고한 시간대별 출발 승객 수")
          : t("기본 곡선 (평소 피크 {time} 기준, 임의)", { time: formatClock(place.peakHour) }),
    },
    {
      ok: !!signals.holidays,
      title: t("요일·공휴일"),
      desc: t("주말·공휴일(한국천문연구원 특일 정보)은 붐비고, 연휴 전날 저녁도 조금 붐비게 계산해요."),
    },
    {
      ok: !!(signals.weather || signals.midWeather),
      title: t("날씨 (야외 비율 {n}%)", { n: outdoor }),
      desc:
        outdoor === 0
          ? t("실내 시설이라 날씨로 혼잡도를 바꾸지 않아요.")
          : t("비·눈이 오면 야외일수록 한산하게, 실내 위주면 사람이 몰리게 계산해요. 3일은 기상청 단기예보(1시간), 4~10일은 중기예보를 써요."),
    },
    {
      ok: !!(signals.air || signals.airForecast),
      title: t("미세먼지"),
      desc:
        outdoor === 0
          ? t("실내 시설이라 반영하지 않아요.")
          : t("초미세먼지 '나쁨'이면 야외 방문이 줄어드는 만큼 낮춰요 (오늘은 실시간 측정, 이후는 에어코리아 예보)."),
    },
    ...(place.kto
      ? [
          {
            ok: !!signals.concentration,
            title: t("관광공사 방문 예측"),
            desc: t("한국관광공사 관광지 집중률 30일 예측이 평소보다 높은 날은 더 붐비게 보정해요."),
          },
        ]
      : []),
  ];

  return (
    <details className="group mt-8 rounded-2xl border border-gray-100 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
        {t("이 혼잡도는 어떻게 판단하나요?")}
        <span className="text-gray-400 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <ul className="mt-3 space-y-2.5">
        {items.map((i) => (
          <li key={i.title} className="flex gap-2 text-xs">
            <span className={i.ok ? "text-emerald-500" : "text-gray-300"}>{i.ok ? "●" : "○"}</span>
            <span>
              <b className="text-gray-800">{i.title}</b>
              <span className="mt-0.5 block text-gray-500">{i.desc}</span>
            </span>
          </li>
        ))}
      </ul>
      {crowd.source === "seoul-citydata" ? (
        <div className="mt-4">
          <p className="text-xs font-bold text-gray-800">{t("이 장소의 단계 기준")} · {t("서울시 공식 혼잡 단계")}</p>
          <div className="mt-2 flex overflow-hidden rounded-lg text-center text-[10px] leading-tight">
            {[
              ["여유", 1],
              ["보통", 2],
              ["약간 붐빔", 3],
              ["붐빔", 4],
            ].map(([official, i]) => {
              const l = LEVELS[i as number];
              return (
                <div key={official} className="flex-1 py-1.5" style={{ background: `${l.color}1f`, color: l.color }}>
                  <b>{t(official as string)}</b>
                  <br />→ {t(l.label)}
                </div>
              );
            })}
          </div>
          {crowd.officialLevel && (
            <p className="mt-1.5 text-[11px] text-gray-500">{t("지금 서울시 공식 단계: ‘{level}’", { level: t(crowd.officialLevel) })}</p>
          )}
        </div>
      ) : place.criteria && (
        <div className="mt-4">
          <p className="text-xs font-bold text-gray-800">
            {t("이 장소의 단계 기준")} · {t(place.criteria.basis)}
            {place.criteria.provisional && <DataTag kind="임의" />}
          </p>
          <div className="mt-2 flex overflow-hidden rounded-lg text-center text-[10px] leading-tight">
            {LEVELS.map((l, i) => {
              const steps = place.criteria!.steps;
              const unit = place.criteria!.unit;
              const fmt = (v: number) => (unit === "명" ? compactNumber(v, lang) : `${v}`);
              const range = i === 0 ? `~${fmt(steps[0])}` : i === 4 ? `${fmt(steps[3])}+` : `${fmt(steps[i - 1])}~${fmt(steps[i])}`;
              return (
                <div key={l.key} className="flex-1 py-1.5" style={{ background: `${l.color}1f`, color: l.color }}>
                  <b>{t(l.label)}</b>
                  <br />
                  {range}
                  {t(unit === "명" ? "명" : "분")}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="mt-2 text-[11px] text-gray-400">
        {t("실제 수치를 이 기준에 대어 단계를 정해요. ● 실제 데이터로 반영 중 · ○ 데이터 없음")}
        {place.criteria?.provisional && ` · ${t("기준은 데이터가 쌓이면 조정해요")}`}
      </p>
    </details>
  );
}
