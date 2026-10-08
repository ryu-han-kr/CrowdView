import { MePanel } from "@/components/MePanel";
import { getAllCrowd } from "@/lib/crowd/service";
import { PLACES } from "@/lib/places";

export const dynamic = "force-dynamic";

const PLANS = [
  { name: "6개월", price: "3,000원", note: "월 500원" },
  { name: "1년", price: "6,000원", note: "월 500원 · 추천", highlight: true },
];

export default async function MePage() {
  const crowd = await getAllCrowd();
  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-bold">마이페이지</h1>

      <section className="mt-5 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white">
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

      <div className="mt-8">
        <MePanel places={PLACES} crowd={crowd} />
      </div>
    </main>
  );
}
