import type { Metadata } from "next";
import Link from "@/i18n/link";
import type { Lang } from "@/i18n/config";
import { pageMeta } from "@/lib/seo";
import { Glyph } from "@/components/Glyph";

// 데이터 출처·계산 방식·한계 공개 (외부 검토: 신뢰·AI 인용을 위해 방법론을 사람이 읽을 수 있게).
// 긴 설명이라 한국어·영어 본문을 여기 두고, 일본어·중국어 화면은 영어 본문을 보여준다
export const revalidate = 86400;

type Copy = {
  title: string;
  lead: string;
  sections: { h: string; body: (string | string[])[] }[];
  sourcesTitle: string;
  sources: [string, string, string][];
  accuracyLink: string;
};

const KO: Copy = {
  title: "데이터 출처와 계산 방식",
  lead: "CrowdView가 보여 주는 혼잡도가 어디서 왔고, 어떻게 계산했고, 어디까지 믿을 수 있는지 정리했어요. 실측과 추정을 화면에서 구분하는 기준도 여기와 같아요.",
  sections: [
    {
      h: "1. 실측·공식 예보·추정의 구분",
      body: [
        [
          "실측: 기관이 지금 측정해 공개한 값 — 서울시 실시간 도시데이터(통신 기반 인구), 인천국제공항공사·한국공항공사 출국장 대기, 놀이기구 대기시간(ThemeParks.wiki)",
          "공식 예보: 기관이 낸 예측 — 서울시 12시간 인구 예측, 공항 시간대별 승객 예고",
          "CrowdView 추정: 실측이 없는 곳·시간에 요일·시간·공휴일·날씨·관광공사 집중률로 계산한 값. 화면에 ‘추정’ 또는 ‘패턴 예측’으로 표시",
          "지역 통계: 축제의 ‘지역 방문 증가 예상’은 축제장 인원이 아니라 그 시군구 전체 방문객(관광공사 데이터랩) 비율",
        ],
      ],
    },
    {
      h: "2. 혼잡 단계",
      body: [
        "모든 화면은 0~100점을 5단계로 나눠요: 한산(0~19) · 여유(20~39) · 보통(40~59) · 혼잡(60~79) · 매우 혼잡(80~100). 색과 함께 글자와 막대 칸 수로도 표시해요.",
        "서울시 데이터가 있는 곳은 서울시 공식 단계를 그대로 써요: 여유 → 여유, 보통 → 보통, 약간 붐빔 → 혼잡, 붐빔 → 매우 혼잡. 그래서 홈·목록·서울 실시간·장소 화면이 같은 시각에 같은 단계를 보여요.",
      ],
    },
    {
      h: "3. 예측 방법",
      body: [
        [
          "앞으로 12시간: 서울시 공식 예측이 있으면 그대로 사용",
          "그 뒤(내일·주말): 가까운 지하철역의 요일별·시간대별 승하차 패턴(서울시 카드 승하차 통계, 최근 4주·지난달)을 그 지역의 지금 혼잡도에 맞춰 늘이거나 줄임. 월 자료가 평일 위주라 주말엔 출퇴근 시간 꼭대기를 낮 수준으로 보정",
          "실측이 없는 장소: 장소별 평소 피크 시각 곡선 + 주말·공휴일 + 날씨(기상청 단기·중기예보, 야외 비율만큼) + 미세먼지 + 관광공사 관광지 집중률 30일 예측",
          "기준선 비교: 패턴 예측과 함께 ‘지금 값 그대로 24시간 뒤’·‘최근 4주 같은 요일·시각 중앙값’ 두 기준선도 매시간 채점해요. 기준선이 최근 7일 단계 일치·평균 오차를 둘 다 더 잘 맞추면 내일·주말 예측을 그 기준선으로 자동 교체해요 (지금 쓰는 방법은 예측 정확도 페이지에)",
          "평소 대비(백분위): 실측 장소는 최근 4주 같은 평일/주말·공휴일 × 같은 시간(앞뒤 1시간) 실제 값 분포에서 지금 값의 위치를 ‘상위 10%·25% / 비슷 / 하위 25%·10%’로 표시해요. 표본이 12개 미만이면 보이지 않아요",
        ],
        "예측이 얼마나 맞는지는 매시간 실제 값과 비교해 공개해요.",
      ],
    },
    {
      h: "4. 한산한 코스 계산",
      body: [
        "도착 시각의 예상 혼잡 + 이동 시간 + 개장 대기 + 식사 시간을 놓치는 벌점이 가장 작은 순서를 찾아요. 최대 6곳을 고른 뒤 가능한 방문 순서를 모두 비교해요.",
        "이동 시간: 1.2km 안은 걷기, 그보다 멀면 지하철 노선망(1~8호선은 서울시 역간 소요시간, 다른 노선은 역 간 거리로 어림) + 역까지 걷기 + 기다림·갈아타기 각 4분. 근처에 역이 없으면 직선거리로 어림해요.",
        "운영 시간 밖에는 넣지 않고, 문 열기 90분 전까지 도착하면 기다렸다 들어가요. 점심(11:30~13:30)·저녁(17:30~19:30)에 걸치면 근처 맛집을 넣어요.",
      ],
    },
    {
      h: "5. 한계",
      body: [
        [
          "서울시 인구는 장소 주변 지역 단위 통신 데이터라 시설 안 인원과 다를 수 있어요",
          "서울시 데이터는 기준 시각이 20~40분 늦게 나와요. 40분 넘게 갱신되지 않으면 ‘갱신 지연’으로 표시해요",
          "실측이 없는 장소와 서울 밖 지역은 추정이라 실제와 차이가 클 수 있어요",
          "버스 경로는 따로 계산하지 않아요",
          "시각 표기: CrowdView는 운영 중인 놀이공원은 5분, 서울시 지역·공항은 10분, 문 닫은 시간과 실측이 없는 장소는 30분마다 가져와요. 화면의 ‘○시 기준’은 원천(서울시 등)의 관측 시각이고, ‘○분 전 갱신’은 CrowdView가 마지막으로 가져온 때예요. 서울시 자료는 5분마다 바뀌지만 기준 시각이 20~40분 늦게 나와 두 시각이 다를 수 있어요",
        ],
      ],
    },
  ],
  sourcesTitle: "데이터 출처",
  sources: [
    ["서울시 실시간 도시데이터", "서울 121곳 인구·12시간 예측", "5분 (수집 10분)"],
    ["인천국제공항공사 · 한국공항공사", "출국장 대기·혼잡, 주차, 승객 예고", "5~30분"],
    ["ThemeParks.wiki · Queue-Times(예비)", "에버랜드·레고랜드·캐리비안베이 놀이기구 대기", "2~5분 (수집 5분)"],
    ["강원랜드 광장주차장 실시간 주차 (공공데이터포털)", "하이원 스키장 주차 대수 → 평소 대비 배율", "5분"],
    ["한국도로공사 · 서울시 도로 소통", "고속도로·서울 주변 도로 속도", "10분"],
    ["한국관광공사 TourAPI · 데이터랩 · 관광지 집중률", "축제 일정, 명소 사진·좌표, 지역 방문객, 30일 예측", "6시간~1주"],
    ["기상청 · 에어코리아 · 한국천문연구원", "날씨·미세먼지·공휴일", "1~12시간"],
    ["서울 열린데이터광장", "지하철 노선·역간 시간·역별 승하차, 화장실·와이파이·문화공간·Visit Seoul", "1주"],
  ],
  accuracyLink: "예측 정확도 보기",
};

const EN: Copy = {
  title: "Data sources and methodology",
  lead: "Where CrowdView's crowd levels come from, how they are calculated, and how far you can trust them. The live vs. estimate labels on every page follow these rules.",
  sections: [
    {
      h: "1. Observed, official forecast, and estimate",
      body: [
        [
          "Observed: values measured and published now by public agencies — Seoul real-time city data (mobile-network population), Incheon International Airport and Korea Airports Corporation departure waits, ride waits (ThemeParks.wiki)",
          "Official forecast: agency forecasts — Seoul 12-hour population forecast, airport hourly passenger notices",
          "CrowdView estimate: computed where/when nothing is measured, from day of week, time, holidays, weather and KTO visitor concentration. Labeled ‘estimate’ or ‘pattern est.’",
          "Area statistics: a festival's ‘expected rise in area visitors’ is the district-wide visitor ratio (KTO DataLab), not people inside the festival grounds",
        ],
      ],
    },
    {
      h: "2. Crowd levels",
      body: [
        "Every page maps a 0–100 score to five levels: very quiet (0–19) · quiet (20–39) · moderate (40–59) · busy (60–79) · very busy (80–100), shown with text and bar segments, not color alone.",
        "Where Seoul data exists we use Seoul's official level as-is (relaxed → quiet, normal → moderate, slightly crowded → busy, crowded → very busy), so all pages show the same level at the same time.",
      ],
    },
    {
      h: "3. Forecasts",
      body: [
        [
          "Next 12 hours: Seoul's official forecast where available",
          "Beyond (tomorrow, weekends): the nearest subway stations' weekday × hour ridership pattern (Seoul card ridership, last 4 weeks and last month), scaled to the area's current level; weekday-heavy monthly data is corrected on weekends by flattening commute peaks",
          "Places without live data: a typical daily curve + weekends/holidays + weather (KMA short/mid-range, weighted by how outdoor the place is) + fine dust + KTO 30-day visitor concentration",
          "Baselines: alongside the pattern forecast we score two baselines every hour — ‘current value carried 24 h ahead’ and ‘median of the same weekday and hour over the last 4 weeks’. If a baseline beats the pattern on both level match and mean error over the last 7 days, tomorrow/weekend forecasts switch to it automatically (the method in use is shown on the accuracy page)",
          "Versus usual (percentile): for places with live data we show where the current value sits in the distribution of the last 4 weeks' same weekday/weekend-holiday × same hour (±1 h): ‘top 10%/25% · about usual · bottom 25%/10%’. Hidden with fewer than 12 samples",
        ],
        "We compare forecasts with actual values every hour and publish the results.",
      ],
    },
    {
      h: "4. Quiet route planning",
      body: [
        "We minimise expected crowd at arrival + travel time + waiting for opening + a penalty for missing meal times, pick up to six stops and compare every visiting order.",
        "Travel: walking within 1.2 km; otherwise the subway network (official station-to-station times for Lines 1–8, distance-based for others) plus walking to stations and 4 minutes each for waiting and transfers; straight-line estimates where no station is near.",
        "Stops are only scheduled inside opening hours; arriving up to 90 minutes early means waiting. Lunch (11:30–13:30) and dinner (17:30–19:30) add a nearby restaurant.",
      ],
    },
    {
      h: "5. Limitations",
      body: [
        [
          "Seoul population covers the area around a place, not just inside a venue",
          "Seoul data arrives 20–40 minutes late; values older than 40 minutes are marked ‘update delayed’",
          "Places without live data and regions outside Seoul are estimates and can differ more",
          "Bus routes are not modelled separately",
          "Timestamps: CrowdView fetches theme parks every 5 minutes while open, Seoul areas and airports every 10, and closed or estimate-only places every 30. ‘As of HH:MM’ is the source's own observation time (e.g. Seoul); ‘updated N min ago’ is when CrowdView last fetched. Seoul data changes every 5 minutes but its reference time lags 20–40 minutes, so the two can differ",
        ],
      ],
    },
  ],
  sourcesTitle: "Data sources",
  sources: [
    ["Seoul real-time city data", "Population and 12-hour forecast for 121 Seoul areas", "5 min (fetched every 10)"],
    ["Incheon International Airport · Korea Airports Corporation", "Departure waits, parking, passenger notices", "5–30 min"],
    ["ThemeParks.wiki · Queue-Times (backup)", "Everland, Legoland and Caribbean Bay ride waits", "2-5 min (fetched every 5)"],
    ["Kangwon Land plaza parking (data.go.kr)", "High1 ski resort occupied spaces → ratio vs. usual", "5 min"],
    ["Korea Expressway Corp. · Seoul road traffic", "Expressway and nearby Seoul road speeds", "10 min"],
    [
      "Korea Tourism Organization TourAPI · DataLab · concentration",
      "Festivals, landmark photos, regional visitors, 30-day forecast",
      "6 h – 1 week",
    ],
    ["KMA · AirKorea · KASI", "Weather, fine dust, public holidays", "1–12 h"],
    ["Seoul Open Data Plaza", "Subway lines, station times and ridership; toilets, Wi-Fi, culture spaces, Visit Seoul", "weekly"],
  ],
  accuracyLink: "See forecast accuracy",
};

const copyOf = (lang: Lang) => (lang === "ko" ? KO : EN);

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  const c = copyOf(lang);
  return pageMeta({ lang, path: "/methodology", title: c.title, description: c.lead });
}

export default async function MethodologyPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const c = copyOf(lang);
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <article className="max-w-3xl">
        <h1 className="text-2xl font-bold md:text-3xl">{c.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{c.lead}</p>
        {c.sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="text-lg font-bold">{s.h}</h2>
            {s.body.map((b, i) =>
              Array.isArray(b) ? (
                <ul key={i} className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700">
                  {b.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : (
                <p key={i} className="mt-2 text-sm leading-relaxed text-gray-700">
                  {b}
                </p>
              ),
            )}
          </section>
        ))}
        <section className="mt-8">
          <h2 className="text-lg font-bold">{c.sourcesTitle}</h2>
          <table className="mt-2 w-full text-left text-sm">
            <tbody>
              {c.sources.map(([src, use, cycle]) => (
                <tr key={src} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-3 font-semibold">{src}</td>
                  <td className="py-2 pr-3 text-gray-600">{use}</td>
                  <td className="py-2 whitespace-nowrap text-gray-500">{cycle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <Link href="/accuracy" className="mt-8 inline-block rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white">
          <Glyph e="📈" /> {c.accuracyLink}
        </Link>
      </article>
    </main>
  );
}
