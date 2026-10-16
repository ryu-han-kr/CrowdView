import Image from "next/image";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "@/i18n/link";
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
import { getAirportPaxDays, getArrivals, getParking, getParkingFees, getParkingZones } from "@/lib/airport";
import { getHistory } from "@/lib/crowd/history";
import { getCrowd } from "@/lib/crowd/service";
import { levelOf } from "@/lib/levels";
import { PLACES, getPlace, imageCreditText } from "@/lib/places";
import { kst } from "@/lib/time";
import type { Lang } from "@/i18n/config";
import { fmtAge, fmtMinutes, fmtPeople, trParking, trZone } from "@/i18n/patterns";
import { getT } from "@/i18n/server";
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

export async function generateMetadata({ params }: { params: Promise<{ id: string; lang: string }> }): Promise<Metadata> {
  const { id, lang } = await params;
  const place = getPlace(id);
  if (!place) return {};
  const t = getT(lang);
  return pageMeta({
    lang,
    path: `/airport/${id}`,
    title: t("{name} 출국장 혼잡도·대기시간", { name: t(place.name) }),
    description: t("{name} 출국장별 실시간 대기시간, 시간대별 출발 승객, 주차장 빈자리와 요금", { name: t(place.name) }),
    image: place.image,
  });
}

export default async function AirportPage({ params }: { params: Promise<{ id: string; lang: string }> }) {
  const { id } = await params;
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const place = getPlace(id);
  if (!place || place.category !== "airport") notFound();

  const [crowd, paxDays, parking, history, fees, signals, arrivals, zones2] = await Promise.all([
    getCrowd(id),
    getAirportPaxDays(place),
    getParking(place),
    getHistory(id, 2),
    getParkingFees(place),
    getSignals(place),
    getArrivals(place),
    getParkingZones(place),
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
        ← {t("공항 목록")}
      </Link>

      {/* PC: 왼쪽(사진·지금·날씨) 고정 + 오른쪽(파트 탭) */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-10">
        <div className="lg:sticky lg:top-24 lg:self-start">
          {place.image && (
            <div className="relative mt-3 h-40 overflow-hidden rounded-3xl bg-gray-100">
              <Image
                src={place.image}
                alt={t(place.name)}
                fill
                priority
                sizes="(max-width: 448px) 100vw, 448px"
                className="object-cover"
              />
              <span className="absolute right-2 bottom-2 rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-white/90">
                {imageCreditText(place, t)}
              </span>
            </div>
          )}

          <header className="mt-3 flex items-center gap-3">
            <PlaceThumb place={place} size={52} />
            <div>
              <h1 className="text-2xl font-bold">{t(place.name)}</h1>
              <p className="text-xs text-gray-500">{place.address}</p>
            </div>
          </header>

          {/* 지금 */}
          {/* 지금 혼잡도 */}
          <section className="mt-4 rounded-3xl px-4 py-3.5" style={{ background: `${level.color}14` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">{t("지금 출국 혼잡도")}</p>
                <p className="text-2xl font-extrabold" style={{ color: crowd.open ? level.color : "#6b7280" }}>
                  {crowd.open ? t(level.label) : t("운영 종료")}
                </p>
                <p className="text-sm text-gray-600">
                  {avgWait !== null && (
                    <>
                      {t("평균 대기")} <b>{fmtMinutes(avgWait, t)}</b> ·{" "}
                    </>
                  )}
                  {headcountInfo(crowd, { t, lang }) && !headcountInfo(crowd, { t, lang })!.kind && (
                    <>{headcountInfo(crowd, { t, lang })!.text} · </>
                  )}
                  {crowd.trend === "up" ? (
                    <span className="text-red-500">{t("늘어나는 중")}</span>
                  ) : crowd.trend === "down" ? (
                    <span className="text-emerald-600">{t("줄어드는 중")}</span>
                  ) : (
                    t("변화 없음")
                  )}
                </p>
              </div>
            </div>
            <p className={`mt-2 text-[11px] ${crowd.stale ? "font-semibold text-amber-600" : "text-gray-400"}`}>
              {crowd.source === "model"
                ? t("실시간 데이터를 받지 못해 예측값을 보여드려요")
                : `${t(SOURCE_LABEL[crowd.source] ?? "")} · ${t("{age} 갱신", { age: fmtAge(crowd.ageMinutes, t) })}`}
            </p>
          </section>
          <WeatherCard signals={signals} lang={lang} place={place} />
        </div>

        <div>
          {/* 파트별 탭: 출국장(구간) · 시간대 · 기록 · 주차 */}
          <div className="mt-6 lg:mt-0">
            <IconTabPanels
              tabs={[
                {
                  id: "zones",
                  label: crowd.source === "incheon-airport" ? t("출국장") : t("보안검색"),
                  icon: ICONS.gate,
                  content:
                    zones.length > 0 ? (
                      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
                        {[...zones]
                          .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
                          .map((z) => (
                            <li key={z.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">{trZone(z.label, t)}</p>
                                {z.hours && (
                                  <p className="text-[11px] text-gray-400">
                                    {t("운영")} {z.hours}
                                  </p>
                                )}
                              </div>
                              {z.waitMin !== undefined && (
                                <span className="text-right text-sm">
                                  <b>{fmtMinutes(z.waitMin, t)}</b>
                                  <span className="block text-[11px] text-gray-400">
                                    {t("{n} 대기", { n: fmtPeople(z.people ?? 0, t, lang) })}
                                  </span>
                                </span>
                              )}
                              <LevelBadge score={z.score} />
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <Empty>{t("지금은 운영 중인 출국장 정보가 없어요.")}</Empty>
                    ),
                },
                ...(place.airport?.startsWith("ICN")
                  ? [
                      {
                        id: "arrivals",
                        label: t("입국"),
                        icon: ICONS.arrival,
                        content:
                          arrivals.flights.length > 0 ? (
                            <>
                              <p className="mb-3 text-xs text-gray-500">{t("지금 기준 앞뒤 2시간 도착편과 입국장(A~F)별 대기 인원이에요. 마중 나갈 때 참고하세요.")}</p>
                              <ul className="grid grid-cols-3 gap-2 md:grid-cols-6">
                                {arrivals.gates.map((g) => (
                                  <li key={g.gate} className="rounded-2xl border border-gray-100 px-3 py-2.5 text-center">
                                    <p className="text-xs text-gray-500">{t("입국장 {gate}", { gate: g.gate })}</p>
                                    <p className="text-lg font-bold">{t("{n}편", { n: g.flights })}</p>
                                    <p className="text-[11px] text-gray-500">{t("{n} 대기", { n: fmtPeople(g.waiting, t, lang) })}</p>
                                  </li>
                                ))}
                              </ul>
                              <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-100 text-sm">
                                {arrivals.flights.slice(0, 30).map((f) => (
                                  <li key={`${f.flight}-${f.time}`} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className={`w-12 shrink-0 font-semibold ${f.late ? "text-amber-600" : ""}`}>{f.time}</span>
                                    <span className="min-w-0 flex-1 truncate">
                                      <b>{f.flight}</b> <span className="text-gray-500">{t("{from} 출발", { from: f.from })}</span>
                                      {f.late && <span className="ml-1 text-[11px] font-semibold text-amber-600">{t("지연")}</span>}
                                    </span>
                                    <span className="shrink-0 text-xs text-gray-500">
                                      {f.entryGate && t("입국장 {gate}", { gate: f.entryGate })}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-2 text-[11px] text-gray-400">{t("인천국제공항공사 입국장 현황 (20분 주기)")}</p>
                            </>
                          ) : (
                            <Empty>{t("지금 앞뒤 2시간 안에 도착하는 항공편 정보가 없어요.")}</Empty>
                          ),
                      },
                    ]
                  : []),
                {
                  id: "hourly",
                  label: t("시간대"),
                  icon: ICONS.clock,
                  content: (
                    <>
                      <p className="mb-4 text-xs text-gray-500">
                        {t("공항이 미리 알려주는 시간대별 출발 승객 수로 붐비는 시간을 피하세요")}
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
                  label: t("기록"),
                  icon: ICONS.history,
                  content: (
                    <div className="pt-4">
                      <HistoryChart days={history} zoneLabels={zoneLabels} now={Date.now()} />
                    </div>
                  ),
                },
                {
                  id: "parking",
                  label: t("주차"),
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
                                ? t("만차")
                                : t(lot.status || (lot.rate >= 90 ? "혼잡" : lot.rate >= 70 ? "보통" : "여유"));
                            return (
                              <li key={lot.name} className="rounded-2xl border border-gray-100 p-3.5">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-semibold">{trParking(lot.name, t, lang)}</span>
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
                                  {t("빈자리")} <b>{t("{n}면", { n: Math.max(0, lot.total - lot.occupied).toLocaleString() })}</b> ·{" "}
                                  {lot.occupied.toLocaleString()} / {t("{n}면", { n: lot.total.toLocaleString() })} ({lot.rate}%) ·{" "}
                                  {t("{time} 기준", { time: lot.updatedAt })}
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <Empty>{t("주차장 정보를 불러오지 못했어요.")}</Empty>
                      )}
                      {zones2.length > 0 && (
                        <div className="mt-5">
                          <p className="text-sm font-bold">{t("단기주차장 구역별 빈자리")}</p>
                          <p className="text-[11px] text-gray-500">{t("주차면 센서 기준이에요. 공항공사가 구역 이름을 주지 않아 번호로 보여드려요.")}</p>
                          <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                            {zones2.map((z) => {
                              const pct = Math.round((z.free / Math.max(1, z.total)) * 100);
                              return (
                                <li key={z.zone} className="rounded-2xl bg-gray-50 px-3 py-2">
                                  <p className="text-xs text-gray-500">{t("구역 {n}", { n: z.zone })}</p>
                                  <p className="text-sm">
                                    <b className={pct < 10 ? "text-red-500" : pct < 25 ? "text-orange-500" : "text-emerald-600"}>
                                      {t("{n}면", { n: z.free.toLocaleString() })}
                                    </b>
                                    <span className="text-[11px] text-gray-400"> / {z.total.toLocaleString()}</span>
                                  </p>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      {fees.length > 0 && (
                        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                          <p className="text-sm font-bold">
                            {t("주차 요금 (소형 기준)")}
                            <DataTag />
                          </p>
                          {fees.map((f) => (
                            <div key={f.group} className="mt-2 text-xs">
                              <p className="font-semibold text-gray-700">{t(f.group)}</p>
                              <ul className="mt-0.5 list-disc pl-4 text-gray-600">
                                {f.lines.map((l) => (
                                  <li key={l}>{l}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                          <p className="mt-2 text-[11px] text-gray-400">
                            {t("인천국제공항공사 요금 기준. 요금 코드에 주차장 이름이 없어 공지된 단기·장기 요금과 맞는 항목만 보여줘요.")}
                            {lang !== "ko" && ` ${t("요금 설명은 공항공사 원문(한국어)이에요.")}`}
                          </p>
                        </div>
                      )}
                    </>
                  ),
                },
              ]}
            />
          </div>

          <JudgementCard place={place} crowd={crowd} signals={signals} lang={lang} />
        </div>
      </div>
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">{children}</p>;
}
