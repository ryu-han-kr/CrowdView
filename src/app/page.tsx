import Link from "next/link";
import { HomeList } from "@/components/HomeList";
import { LevelBadge, LevelLegend } from "@/components/Level";
import { PlaceThumb } from "@/components/PlaceRow";
import { TrendCarousel } from "@/components/TrendCarousel";
import { getAllCrowd } from "@/lib/crowd/service";
import { PLACES } from "@/lib/places";
import { formatAge } from "@/lib/time";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;

export default async function HomePage() {
  const crowd = await getAllCrowd();
  const ages = Object.values(crowd).map((c) => c.ageMinutes);
  const anyStale = Object.values(crowd).some((c) => c.stale);

  const trendRank = { up: 0, flat: 1, down: 2 } as const;
  const trending = PLACES.filter((p) => !p.eventDate || crowd[p.id].score >= 40)
    .map((place) => ({ place, crowd: crowd[place.id] }))
    .sort(
      (a, b) =>
        Number(b.crowd.open) - Number(a.crowd.open) ||
        trendRank[a.crowd.trend] - trendRank[b.crowd.trend] ||
        b.crowd.score - a.crowd.score,
    )
    .slice(0, 5);

  const calm = PLACES.filter((p) => crowd[p.id].open && p.category !== "event" && crowd[p.id].score < 40)
    .sort((a, b) => crowd[a.id].score - crowd[b.id].score)
    .slice(0, 3);

  return (
    <main className="px-5 pt-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-indigo-500">CrowdView Pulse</p>
          <h1 className="mt-1 text-2xl font-bold">지금 어디가 한산할까?</h1>
        </div>
        <span className={`flex items-center gap-1.5 text-xs ${anyStale ? "text-amber-600" : "text-gray-500"}`}>
          <span className="relative flex h-2 w-2">
            <span className={`pulse-ring absolute inline-flex h-full w-full rounded-full ${anyStale ? "bg-amber-400" : "bg-emerald-400"}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${anyStale ? "bg-amber-500" : "bg-emerald-500"}`} />
          </span>
          {formatAge(Math.max(...ages))} 갱신
        </span>
      </header>

      <div className="mt-4">
        <LevelLegend />
      </div>

      <section className="mt-7">
        <h2 className="mb-3 text-lg font-bold">🔥 실시간 트렌드</h2>
        <TrendCarousel items={trending} />
      </section>

      {calm.length > 0 && (
        <section className="mt-7 rounded-3xl bg-emerald-50 p-4">
          <h2 className="font-bold text-emerald-900">🌿 지금 가면 쾌적해요</h2>
          <p className="mt-0.5 text-xs text-emerald-700">영업 중이면서 혼잡도가 낮은 곳</p>
          <ul className="mt-3 space-y-2">
            {calm.map((p) => (
              <li key={p.id}>
                <Link href={`/place/${p.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-2.5">
                  <PlaceThumb place={p} size={40} />
                  <span className="flex-1 text-sm font-semibold">{p.name}</span>
                  <LevelBadge score={crowd[p.id].score} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-7">
        <h2 className="mb-3 text-lg font-bold">전체 장소</h2>
        <HomeList places={PLACES} crowd={crowd} />
      </section>
    </main>
  );
}
