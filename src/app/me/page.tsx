import { MePanel } from "@/components/MePanel";
import { getAllCrowd } from "@/lib/crowd/service";
import { PLACES } from "@/lib/places";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;

const PLANS = [
  { name: "6개월", price: "3,000원", note: "월 500원" },
  { name: "1년", price: "6,000원", note: "월 500원 · 추천", highlight: true },
];

export default async function MePage() {
  const crowd = await getAllCrowd();
  return (
    <main className="px-5 pt-6 md:px-0 md:pt-10">
      <h1 className="text-2xl font-bold md:text-3xl">마이페이지</h1>

      <div className="mt-6">
        <MePanel places={PLACES} crowd={crowd} />
      </div>

      <section className="mt-10 mb-6 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white">
        <p className="text-xs font-semibold opacity-80">CrowdView Pulse+</p>
        <p className="mt-1 text-lg font-bold">AI 예측 · 혼잡 알림 · 광고 제거</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {PLANS.map((p) => (
            <div key={p.name} className={`rounded-2xl p-3 ${p.highlight ? "bg-white text-gray-900" : "bg-white/15"}`}>
              <p className="text-xs opacity-70">{p.name}</p>
              <p className="text-lg font-extrabold">{p.price}</p>
              <p className="text-[11px] opacity-70">{p.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] opacity-70">결제 연동 준비 중</p>
      </section>

      <p className="mb-6 text-center text-[11px] leading-relaxed text-gray-400">
        혼잡도: 서울시, 인천국제공항공사, 한국공항공사, 한국관광공사, 기상청 (공공데이터포털)
        <br />
        놀이기구 대기시간: Powered by ThemeParks.wiki · 운영 시간·행사 일정: 한국관광공사 TourAPI
        <br />
        장소 사진: 한국관광공사 (공공누리)
        {PLACES.filter((p) => p.imageCredit).map((p) => (
          <span key={p.id}>
            <br />
            {p.name}:{" "}
            <a href={p.imageCredit!.url} target="_blank" rel="noreferrer" className="underline">
              {p.imageCredit!.author}, {p.imageCredit!.license}
            </a>{" "}
            (Wikimedia Commons)
          </span>
        ))}
      </p>
    </main>
  );
}
