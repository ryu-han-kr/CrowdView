import { OUTDOOR } from "@/lib/crowd/model";
import type { Signals } from "@/lib/crowd/signals";
import { LEVELS } from "@/lib/levels";
import { formatClock } from "@/lib/time";
import type { CrowdResult, Place } from "@/lib/types";


const LIVE: Partial<Record<CrowdResult["source"], string>> = {
  "seoul-citydata": "서울시 실시간 도시데이터 (통신 기반 인구, 5분 단위)",
  "incheon-airport": "인천국제공항공사 출국장 대기시간·인원 (1분 단위)",
  "kac-airport": "한국공항공사 구간별 혼잡도 (체크인~탑승)",
  "themeparks-wiki": "놀이기구 대기시간 평균 (ThemeParks.wiki, 5분 단위)",
};

/** "이 혼잡도는 어떻게 판단하나요?" — 장소마다 실제로 쓰인 데이터와 보정 요소를 보여준다 */
export function JudgementCard({ place, crowd, signals }: { place: Place; crowd: CrowdResult; signals: Signals }) {
  const outdoor = Math.round((place.outdoor ?? OUTDOOR[place.category]) * 100);
  const live = LIVE[crowd.source];
  const items: { ok: boolean; title: string; desc: string }[] = [
    {
      ok: !!live,
      title: live ? "지금 혼잡도: 실측" : "지금 혼잡도: 추정",
      desc: live ?? "이 장소는 실시간 데이터가 없어 아래 요소로 계산한 예측값이에요.",
    },
    {
      ok: !!(signals.localPop || signals.pax),
      title: "시간대 패턴",
      desc: signals.localPop
        ? "부산시 생활인구(통신데이터) 같은 달 평균 방문인구"
        : signals.pax
          ? "공항공사가 예고한 시간대별 출발 승객 수"
          : `기본 곡선 (평소 피크 ${formatClock(place.peakHour)} 기준, 임의)`,
    },
    {
      ok: !!signals.holidays,
      title: "요일·공휴일",
      desc: "주말·공휴일(한국천문연구원 특일 정보)은 붐비고, 연휴 전날 저녁도 조금 붐비게 계산해요.",
    },
    {
      ok: !!(signals.weather || signals.midWeather),
      title: `날씨 (야외 비율 ${outdoor}%)`,
      desc:
        outdoor === 0
          ? "실내 시설이라 날씨로 혼잡도를 바꾸지 않아요."
          : `비·눈이 오면 야외일수록 한산하게, 실내 위주면 사람이 몰리게 계산해요. 3일은 기상청 단기예보(1시간), 4~10일은 중기예보를 써요.`,
    },
    {
      ok: !!(signals.air || signals.airForecast),
      title: "미세먼지",
      desc:
        outdoor === 0
          ? "실내 시설이라 반영하지 않아요."
          : "초미세먼지 '나쁨'이면 야외 방문이 줄어드는 만큼 낮춰요 (오늘은 실시간 측정, 이후는 에어코리아 예보).",
    },
    ...(place.kto
      ? [{ ok: !!signals.concentration, title: "관광공사 방문 예측", desc: "한국관광공사 관광지 집중률 30일 예측이 평소보다 높은 날은 더 붐비게 보정해요." }]
      : []),
  ];

  return (
    <details className="group mt-8 rounded-2xl border border-gray-100 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
        이 혼잡도는 어떻게 판단하나요?
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
      <div className="mt-4 flex overflow-hidden rounded-lg text-center text-[10px]">
        {LEVELS.map((l, i) => (
          <div key={l.key} className="flex-1 py-1" style={{ background: `${l.color}1f`, color: l.color }}>
            <b>{l.label}</b>
            <br />
            {l.min}~{LEVELS[i + 1]?.min ?? 100}점
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        모든 데이터를 0~100점으로 맞춘 뒤 5단계로 나눠요. ● 실제 데이터로 반영 중 · ○ 데이터 없음
      </p>
    </details>
  );
}
