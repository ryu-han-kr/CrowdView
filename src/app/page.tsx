import Link from "next/link";
import { DataTag } from "@/components/DataTag";
import { EventDateTag } from "@/components/EventDateTag";
import { HomeList } from "@/components/HomeList";
import { LevelBadge } from "@/components/Level";
import { PlaceThumb } from "@/components/PlaceRow";
import { getAllCrowd } from "@/lib/crowd/service";
import { getLivePlaces, isOngoingEvent, isUpcomingEvent } from "@/lib/place-info";
import { placeHref } from "@/lib/places";
import { isEstimated } from "@/lib/format";
import { daysUntil, formatAge } from "@/lib/time";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;

export default async function HomePage() {
  const [crowd, places] = await Promise.all([getAllCrowd(), getLivePlaces()]);
  const live = Object.values(crowd).filter((c) => c.source !== "model");
  const newest = live.length ? Math.min(...live.map((c) => c.ageMinutes)) : null;

  const calm = places.filter((p) => crowd[p.id].open && p.category !== "event" && crowd[p.id].score < 40)
    .sort((a, b) => crowd[a.id].score - crowd[b.id].score)
    .slice(0, 3);

  const events = places.filter((p) => isUpcomingEvent(p))
    .sort((a, b) => a.eventDate!.localeCompare(b.eventDate!))
    .slice(0, 2);

  return (
    <main className="px-5 pt-6 pb-4 md:px-0 md:pt-10">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-indigo-500">CrowdView</p>
          <h1 className="mt-1 text-2xl font-bold md:text-4xl">지금 어디가 한산할까?</h1>
          <p className="mt-2 hidden text-gray-500 md:block">공항·놀이공원·명소·축제의 실시간 혼잡도와 AI 예측을 한눈에</p>
        </div>
        {newest !== null && (
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="relative flex h-2 w-2">
              <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {formatAge(newest)} 갱신
          </span>
        )}
      </header>

      <HomeList places={places} crowd={crowd}>
        <div className="md:mt-6 md:grid md:grid-cols-2 md:items-start md:gap-6">
        {calm.length > 0 && (
          <section className="mt-4 rounded-3xl bg-emerald-50 p-4">
            <h2 className="font-bold text-emerald-900">🌿 지금 가면 쾌적해요</h2>
            <ul className="mt-3 space-y-2">
              {calm.map((p) => (
                <li key={p.id}>
                  <Link href={placeHref(p)} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 active:opacity-70">
                    <PlaceThumb place={p} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="block text-xs text-gray-500">{p.region}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <LevelBadge score={crowd[p.id].score} />
                      {isEstimated(crowd[p.id]) && <DataTag className="mt-0.5" />}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {events.length > 0 && (
          <section className="mt-6 md:mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">🎆 다가오는 이벤트</h2>
              <Link href="/events" className="text-sm text-gray-500">
                전체 보기 ›
              </Link>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {events.map((p) => (
                <li key={p.id}>
                  <Link href={placeHref(p)} className="block rounded-2xl border border-gray-100 p-3 active:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <PlaceThumb place={p} size={36} />
                      <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-bold text-white">
                        {isOngoingEvent(p) ? "진행 중" : daysUntil(p.eventDate!) === 0 ? "D-DAY" : `D-${daysUntil(p.eventDate!)}`}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.eventDate!.slice(5).replace("-", "/")}
                      <EventDateTag place={p} /> · {p.region}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        </div>
      </HomeList>
    </main>
  );
}
