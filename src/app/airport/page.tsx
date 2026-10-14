import Link from "next/link";
import { LevelBadge } from "@/components/Level";
import { PlaceThumb } from "@/components/PlaceRow";
import { getParking } from "@/lib/airport";
import { getAllCrowd } from "@/lib/crowd/service";
import { PLACES } from "@/lib/places";
import { formatAge } from "@/lib/time";
import { headcountInfo } from "@/lib/format";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;

const AIRPORTS = PLACES.filter((p) => p.category === "airport");

export default async function AirportListPage() {
  const [crowd, parking] = await Promise.all([getAllCrowd(), Promise.all(AIRPORTS.map(getParking))]);

  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-bold">공항 혼잡도</h1>
      <p className="mt-1 text-sm text-gray-500">출국장 대기·보안검색 구간·주차장까지 한눈에</p>

      <ul className="mt-5 space-y-3">
        {AIRPORTS.map((place, i) => {
          const c = crowd[place.id];
          const busiestZone = c.zones?.reduce((a, b) => (b.score > a.score ? b : a));
          const lots = parking[i];
          const fullLots = lots.filter((l) => l.rate >= 90).length;
          return (
            <li key={place.id}>
              <Link href={`/airport/${place.id}`} className="block rounded-3xl border border-gray-100 p-4 active:bg-gray-50">
                <div className="flex items-center gap-3">
                  <PlaceThumb place={place} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{place.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {c.source === "model" ? "예측값" : `${formatAge(c.ageMinutes)} 실측`}
                      {headcountInfo(c) && !headcountInfo(c)!.kind && ` · ${headcountInfo(c)!.text}`}
                    </p>
                  </div>
                  <LevelBadge score={c.score} closed={!c.open} />
                </div>
                {(busiestZone || lots.length > 0) && (
                  <div className="mt-3 space-y-1 rounded-2xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
                    {busiestZone && (
                      <p>
                        가장 붐비는 곳 <b>{busiestZone.label}</b>
                        {busiestZone.waitMin !== undefined && ` · 대기 ${busiestZone.waitMin}분`}
                      </p>
                    )}
                    {lots.length > 0 && (
                      <p>
                        주차장 {lots.length}곳 중 <b className={fullLots ? "text-red-500" : ""}>{fullLots}곳 만차 임박</b>
                      </p>
                    )}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 mb-6 text-center text-[11px] text-gray-400">
        출처: 인천국제공항공사, 한국공항공사 (공공데이터포털)
      </p>
    </main>
  );
}
