import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AirportPaxChart } from "@/components/AirportPaxChart";
import { DataTag } from "@/components/DataTag";
import { JudgementCard } from "@/components/JudgementCard";
import { WeatherCard } from "@/components/WeatherCard";
import { getSignals } from "@/lib/crowd/signals";
import { HistoryChart } from "@/components/HistoryChart";
import { ICONS, IconTabPanels } from "@/components/IconTabs";
import { LevelBadge } from "@/components/Level";
import { PlaceThumb } from "@/components/PlaceRow";
import { getAirportPaxDays, getParking, getParkingFees } from "@/lib/airport";
import { getHistory } from "@/lib/crowd/history";
import { getCrowd } from "@/lib/crowd/service";
import { levelOf } from "@/lib/levels";
import { PLACES, getPlace, imageCreditText } from "@/lib/places";
import { formatAge, kst } from "@/lib/time";
import { headcountInfo } from "@/lib/format";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;

export function generateStaticParams() {
  return PLACES.filter((p) => p.category === "airport").map((p) => ({
    id: p.id,
  }));
}

const SOURCE_LABEL = {
  "incheon-airport": "인천국제공항공사 출국장 혼잡도 (1분 주기)",
  "kac-airport": "한국공항공사 공항 혼잡도",
} as Record<string, string>;

export default async function AirportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = getPlace(id);
  if (!place || place.category !== "airport") notFound();

  const [crowd, paxDays, parking, history, fees, signals] = await Promise.all([
    getCrowd(id),
    getAirportPaxDays(place),
    getParking(place),
    getHistory(id, 2),
    getParkingFees(place),
    getSignals(place),
  ]);
  if (!crowd) notFound();

  const now = kst();
  const level = levelOf(crowd.score);
  const zones = crowd.zones ?? [];
  const avgWait =
    zones.length && zones[0].waitMin !== undefined
      ? Math.round(zones.reduce((s, z) => s + (z.waitMin ?? 0), 0) / zones.length)
      : null;
  const zoneLabels = Object.fromEntries(zones.map((z) => [z.id, z.label]));

  return (
    <main className="px-5 pt-4 pb-8 md:px-0 md:pt-8">
      <Link href="/airport" className="text-sm text-gray-500">
        ← 공항 목록
      </Link>

      {/* PC: 왼쪽(사진·지금·날씨) 고정 + 오른쪽(파트 탭) */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-10">
        <div className="lg:sticky lg:top-24 lg:self-start">
          {place.image && (
            <div className="relative mt-3 h-40 overflow-hidden rounded-3xl bg-gray-100">
              <Image
                src={place.image}
                alt={place.name}
                fill
                priority
                sizes="(max-width: 448px) 100vw, 448px"
                className="object-cover"
              />
              <span className="absolute right-2 bottom-2 rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-white/90">
                {imageCreditText(place)}
              </span>
            </div>
          )}

          <header className="mt-3 flex items-center gap-3">
            <PlaceThumb place={place} size={52} />
            <div>
              <h1 className="text-2xl font-bold">{place.name}</h1>
              <p className="text-xs text-gray-500">{place.address}</p>
            </div>
          </header>

          {/* 지금 */}
          {/* 지금 혼잡도 */}
          <section className="mt-4 rounded-3xl px-4 py-3.5" style={{ background: `${level.color}14` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">지금 출국 혼잡도</p>
                <p className="text-2xl font-extrabold" style={{ color: crowd.open ? level.color : "#6b7280" }}>
                  {crowd.open ? level.label : "운영 종료"}
                </p>
                <p className="text-sm text-gray-600">
                  {avgWait !== null && (
                    <>
                      평균 대기 <b>{avgWait}분</b> ·{" "}
                    </>
                  )}
                  {headcountInfo(crowd) && !headcountInfo(crowd)!.kind && <>{headcountInfo(crowd)!.text} · </>}
                  {crowd.trend === "up" ? (
                    <span className="text-red-500">늘어나는 중</span>
                  ) : crowd.trend === "down" ? (
                    <span className="text-emerald-600">줄어드는 중</span>
                  ) : (
                    "변화 없음"
                  )}
                </p>
              </div>
            </div>
            <p className={`mt-2 text-[11px] ${crowd.stale ? "font-semibold text-amber-600" : "text-gray-400"}`}>
              {crowd.source === "model"
                ? "실시간 데이터를 받지 못해 예측값을 보여드려요"
                : `${SOURCE_LABEL[crowd.source]} · ${formatAge(crowd.ageMinutes)} 갱신`}
            </p>
          </section>
          <WeatherCard signals={signals} />
        </div>

        <div>
          {/* 파트별 탭: 출국장(구간) · 시간대 · 기록 · 주차 */}
          <div className="mt-6 lg:mt-0">
            <IconTabPanels
              tabs={[
                {
                  id: "zones",
                  label: crowd.source === "incheon-airport" ? "출국장" : "보안검색",
                  icon: ICONS.gate,
                  content:
                    zones.length > 0 ? (
                      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
                        {[...zones]
                          .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
                          .map((z) => (
                            <li key={z.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">{z.label}</p>
                                {z.hours && <p className="text-[11px] text-gray-400">운영 {z.hours}</p>}
                              </div>
                              {z.waitMin !== undefined && (
                                <span className="text-right text-sm">
                                  <b>{z.waitMin}분</b>
                                  <span className="block text-[11px] text-gray-400">
                                    {(z.people ?? 0).toLocaleString()}명 대기
                                  </span>
                                </span>
                              )}
                              <LevelBadge score={z.score} />
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <Empty>지금은 운영 중인 출국장 정보가 없어요.</Empty>
                    ),
                },
                {
                  id: "hourly",
                  label: "시간대",
                  icon: ICONS.clock,
                  content: (
                    <>
                      <p className="mb-4 text-xs text-gray-500">
                        공항이 미리 알려주는 시간대별 출발 승객 수로 붐비는 시간을 피하세요
                      </p>
                      <AirportPaxChart
                        days={paxDays}
                        steps={place.paxSteps ?? [800, 1400, 2000, 2600]}
                        today={now.date}
                        nowHour={now.hour}
                      />
                    </>
                  ),
                },
                {
                  id: "history",
                  label: "기록",
                  icon: ICONS.history,
                  content: (
                    <div className="pt-4">
                      <HistoryChart days={history} zoneLabels={zoneLabels} now={Date.now()} />
                    </div>
                  ),
                },
                {
                  id: "parking",
                  label: "주차",
                  icon: ICONS.parking,
                  content: (
                    <>
                      {parking.length > 0 ? (
                        <ul className="space-y-3">
                          {parking.map((lot) => {
                            const color =
                              lot.rate >= 95
                                ? "#ef4444"
                                : lot.rate >= 85
                                  ? "#f97316"
                                  : lot.rate >= 70
                                    ? "#eab308"
                                    : "#10b981";
                            const label =
                              lot.rate >= 99
                                ? "만차"
                                : lot.status || (lot.rate >= 90 ? "혼잡" : lot.rate >= 70 ? "보통" : "여유");
                            return (
                              <li key={lot.name} className="rounded-2xl border border-gray-100 p-3.5">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-semibold">{lot.name}</span>
                                  <span className="font-semibold" style={{ color }}>
                                    {label}
                                  </span>
                                </div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${lot.rate}%`,
                                      background: color,
                                    }}
                                  />
                                </div>
                                <p className="mt-1.5 text-[11px] text-gray-500">
                                  빈자리 <b>{Math.max(0, lot.total - lot.occupied).toLocaleString()}</b>면 ·{" "}
                                  {lot.occupied.toLocaleString()} / {lot.total.toLocaleString()}면 ({lot.rate}%) ·{" "}
                                  {lot.updatedAt} 기준
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <Empty>주차장 정보를 불러오지 못했어요.</Empty>
                      )}
                      {fees.length > 0 && (
                        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                          <p className="text-sm font-bold">
                            주차 요금 (소형 기준)
                            <DataTag />
                          </p>
                          {fees.map((f) => (
                            <div key={f.group} className="mt-2 text-xs">
                              <p className="font-semibold text-gray-700">{f.group}</p>
                              <ul className="mt-0.5 list-disc pl-4 text-gray-600">
                                {f.lines.map((l) => (
                                  <li key={l}>{l}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                          <p className="mt-2 text-[11px] text-gray-400">
                            인천국제공항공사 요금 기준. 요금 코드에 주차장 이름이 없어 공지된 단기·장기 요금과 맞는
                            항목만 보여줘요.
                          </p>
                        </div>
                      )}
                    </>
                  ),
                },
              ]}
            />
          </div>

          <JudgementCard place={place} crowd={crowd} signals={signals} />
        </div>
      </div>
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">{children}</p>;
}
