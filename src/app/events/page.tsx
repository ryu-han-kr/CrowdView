import Link from "next/link";
import { LevelBadge } from "@/components/Level";
import { PlaceThumb } from "@/components/PlaceRow";
import { forecastForDate } from "@/lib/crowd/model";
import { PLACES } from "@/lib/places";
import { daysUntil, formatHour } from "@/lib/time";

// D-day만 바뀌므로 1시간 단위로 다시 렌더링해도 충분하다
export const revalidate = 3600;

export default function EventsPage() {
  const events = PLACES.filter((p) => p.eventDate)
    .map((place) => {
      const dday = daysUntil(place.eventDate!);
      const peak = [...forecastForDate(place, place.eventDate!)].sort((a, b) => b.score - a.score)[0];
      return { place, dday, peak, visitors: Math.round((place.capacity * peak.score) / 100) };
    })
    .filter((e) => e.dday >= 0)
    .sort((a, b) => a.dday - b.dday);

  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-bold">다가오는 이벤트</h1>
      <p className="mt-1 text-sm text-gray-500">AI가 예측한 당일 최대 인원과 피크 시간대</p>

      <ul className="mt-5 space-y-3">
        {events.map(({ place, dday, peak, visitors }) => (
          <li key={place.id}>
            <Link href={`/place/${place.id}`} className="block rounded-3xl border border-gray-100 p-4 active:bg-gray-50">
              <div className="flex items-center gap-3">
                <PlaceThumb place={place} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{place.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {place.eventDate} · {place.region}
                  </p>
                </div>
                <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
                  {dday === 0 ? "D-DAY" : `D-${dday}`}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2.5 text-sm">
                <span>
                  피크 <b>{formatHour(peak.hour)}</b> · 약 <b>{visitors.toLocaleString()}명</b>
                </span>
                <LevelBadge score={peak.score} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-center text-[11px] text-gray-400">일정은 샘플 데이터이며 실제와 다를 수 있어요.</p>
    </main>
  );
}
