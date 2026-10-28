import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { inkOf } from "@/lib/levels";
import { CrowdMascot } from "@/components/place/CrowdMascot";
import { EmptyState } from "@/components/EmptyState";
import Link from "@/i18n/link";
import { notFound } from "next/navigation";
import { AirportPaxChart } from "@/components/AirportPaxChart";
import { DataTag } from "@/components/DataTag";
import { JudgementCard } from "@/components/JudgementCard";
import { InlineAd } from "@/components/AdUnit";
import { FaqBlock } from "@/components/FaqBlock";
import { WeatherCard } from "@/components/WeatherCard";
import { getSignals } from "@/lib/crowd/signals";
import { HistoryChart } from "@/components/HistoryChart";
import { ChipTabPanels } from "@/components/IconTabs";
import { LevelBadge } from "@/components/Level";
import { PlaceThumb } from "@/components/PlaceRow";
import { getAirportPaxDays, getArrivals, getParking, getParkingFees, getParkingZones } from "@/lib/airport";
import { getHistory } from "@/lib/crowd/history";
import { getCrowd } from "@/lib/crowd/service";
import { levelOf } from "@/lib/levels";
import { PLACES, getPlace, photoCreditText } from "@/lib/places";
import { PhotoGallery } from "@/components/PhotoGallery";
import placeImages from "@/data/korea/place-images.json";
import { kst } from "@/lib/time";
import { DEFAULT_LANG, type Lang } from "@/i18n/config";
import { fmtAge, fmtMinutes, fmtPeople, trParking, trZone } from "@/i18n/patterns";
import { getT } from "@/i18n/server";
import { headcountInfo } from "@/lib/format";
import { translateNames } from "@/lib/name-translate";
import { KstNote } from "@/components/LocalTime";
import { AIRPORT_PICKS, TourLinks } from "@/components/StayLinks";

// ISR: CDN이 5분 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
// (60초였을 때 ISR 쓰기 5일에 13만 건. 데이터는 10분마다 갱신되니 5분이면 충분)
export const revalidate = 300;

// 빌드 때는 한국어만 미리 만들고 다른 언어는 처음 열 때 만든다 (빌드 페이지 약 1,300개 → 500개 아래, Vercel 빌드 시간 절약)
export function generateStaticParams({ params }: { params: { lang: string } }) {
  if (params.lang !== DEFAULT_LANG) return [];
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
  const photos = [...new Set([...(place.image ? [place.image] : []), ...((placeImages as Record<string, string[]>)[place.id] ?? [])])];
  // 주소도 외국어 화면에서는 번역 (외부 점검: en 화면 한국어 노출)
  const address = (await translateNames([place.address], lang)).get(place.address) ?? place.address;

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
  const avgWait = zones.length && zones[0].waitMin !== undefined ? Math.round(zones.reduce((s, z) => s + (z.waitMin ?? 0), 0) / zones.length) : null;
  const zoneLabels = Object.fromEntries(zones.map((z) => [z.id, z.label]));

  return (
    <main className="px-5 pt-4 pb-8 md:px-0 md:pt-8">
      <Link href="/airport" className="text-sm text-gray-500">
        ← {t("공항 목록")}
      </Link>

      {/* PC: 왼쪽(사진·지금·날씨) 고정 + 오른쪽(파트 탭) */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-10">
        <div className="lg:sticky lg:top-24 lg:self-start">
          {/* 사진 여러 장 옆으로 넘겨 보기 (장소 상세와 같은 방식) */}
          {photos.length > 0 && (
            <PhotoGallery
              photos={photos}
              alt={t(place.name)}
              credits={photos.map((src) => photoCreditText(src, place, t))}
              sizes="(max-width: 448px) 100vw, 448px"
              className="mt-3 h-48 rounded-3xl bg-gray-100 md:h-56"
            />
          )}

          <header className="mt-3 flex items-center gap-3">
            <PlaceThumb place={place} size={52} />
            <div>
              <h1 className="text-2xl font-bold">{t(place.name)}</h1>
              <p className="text-xs text-gray-500">{address}</p>
              <KstNote />
            </div>
          </header>

          {/* 지금 */}
          {/* 지금 혼잡도 */}
          <section
            className="mt-4 rounded-3xl px-4 py-4"
            style={{ background: `${crowd.open ? level.color : "#6b7280"}24`, boxShadow: `inset 0 0 0 1.5px ${crowd.open ? level.color : "#6b7280"}55` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-gray-800">{t("지금 출국 혼잡도")}</p>
                <p className="text-[34px] leading-tight font-black" style={{ color: crowd.open ? inkOf(level.color) : "#4b5563" }}>
                  {crowd.open ? t(level.label) : t("운영 종료")}
                </p>
                <p className="mt-1 text-[16px] font-semibold text-gray-900">
                  {avgWait !== null && (
                    <>
                      <span className="whitespace-nowrap">
                        {t("평균 대기")} <b>{fmtMinutes(avgWait, t)}</b>
                      </span>{" "}
                      ·{" "}
                    </>
                  )}
                  {headcountInfo(crowd, { t, lang }) && !headcountInfo(crowd, { t, lang })!.kind && (
                    <>
                      <span className="whitespace-nowrap">{headcountInfo(crowd, { t, lang })!.text}</span> ·{" "}
                    </>
                  )}
                  {crowd.trend === "up" ? (
                    <span className="whitespace-nowrap text-red-700 dark:text-red-400">{t("늘어나는 중")}</span>
                  ) : crowd.trend === "down" ? (
                    <span className="whitespace-nowrap text-emerald-700">{t("줄어드는 중")}</span>
                  ) : (
                    t("변화 없음")
                  )}
                </p>
              </div>
              <CrowdMascot character="raccoon" score={crowd.score} closed={!crowd.open} size={104} className="-my-1 shrink-0" label={crowd.open ? t(level.label) : t("운영 종료")} />
            </div>
            <p className={`sector-box mt-3 text-[13px] ${crowd.stale ? "font-semibold text-amber-800" : "text-gray-700"}`}>
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
            <ChipTabPanels
              tabs={[
                {
                  id: "zones",
                  label: crowd.source === "incheon-airport" ? t("출국장") : t("보안검색"),
                  emoji: "🛂",
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
                                  <p className="text-[11px] text-gray-500">
                                    {t("운영")} {z.hours}
                                  </p>
                                )}
                              </div>
                              {z.waitMin !== undefined && (
                                <span className="text-right text-sm">
                                  <b>{fmtMinutes(z.waitMin, t)}</b>
                                  <span className="block text-[11px] text-gray-500">{t("{n} 대기", { n: fmtPeople(z.people ?? 0, t, lang) })}</span>
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
                        emoji: "🛬",
                        content:
                          arrivals.flights.length > 0 ? (
                            <>
                              <p className="mb-3 text-xs text-gray-500">
                                {t("지금 기준 앞뒤 2시간 도착편과 입국장(A~F)별 대기 인원이에요. 마중 나갈 때 참고하세요.")}
                              </p>
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
                                    <span className={`w-12 shrink-0 font-semibold ${f.late ? "text-amber-700" : ""}`}>{f.time}</span>
                                    <span className="min-w-0 flex-1 truncate">
                                      <b>{f.flight}</b> <span className="text-gray-500">{t("{from} 출발", { from: f.from })}</span>
                                      {f.late && <span className="ml-1 text-[11px] font-semibold text-amber-700">{t("지연")}</span>}
                                    </span>
                                    <span className="shrink-0 text-xs text-gray-500">{f.entryGate && t("입국장 {gate}", { gate: f.entryGate })}</span>
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-2 text-[11px] text-gray-500">{t("인천국제공항공사 입국장 현황 (20분 주기)")}</p>
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
                  emoji: "🕒",
                  content: (
                    <>
                      <p className="mb-4 text-xs text-gray-500">{t("공항이 미리 알려주는 시간대별 출발 승객 수로 붐비는 시간을 피하세요")}</p>
                      <AirportPaxChart days={paxDays} steps={place.paxSteps ?? [800, 1400, 2000, 2600]} today={now.date} nowHour={now.hour} />
                    </>
                  ),
                },
                {
                  id: "history",
                  label: t("기록"),
                  emoji: "📈",
                  content: (
                    <div className="pt-4">
                      <HistoryChart days={history} zoneLabels={zoneLabels} now={Date.now()} />
                    </div>
                  ),
                },
                {
                  id: "parking",
                  label: t("주차"),
                  emoji: "🅿️",
                  content: (
                    <>
                      {parking.length > 0 ? (
                        <ul className="space-y-3">
                          {parking.map((lot) => {
                            const color = lot.rate >= 95 ? "#ef4444" : lot.rate >= 85 ? "#f97316" : lot.rate >= 70 ? "#eab308" : "#10b981";
                            const label = lot.rate >= 99 ? t("만차") : t(lot.status || (lot.rate >= 90 ? "혼잡" : lot.rate >= 70 ? "보통" : "여유"));
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
                                  {/* 전체 면수가 없으면(센서 자료 없음) 빈자리를 지어내지 않고, 빈자리 0이면 '만차' (AIR-S02) */}
                                  {lot.total === 0 ? (
                                    <>{t("면수 자료 없음")} · </>
                                  ) : lot.total - lot.occupied <= 0 ? (
                                    <>
                                      <b className="text-red-600">{t("만차")}</b> · {lot.occupied.toLocaleString()} / {t("{n}면", { n: lot.total.toLocaleString() })} ·{" "}
                                    </>
                                  ) : (
                                    <>
                                      {t("빈자리")} <b>{t("{n}면", { n: (lot.total - lot.occupied).toLocaleString() })}</b> · {lot.occupied.toLocaleString()} /{" "}
                                      {t("{n}면", { n: lot.total.toLocaleString() })} ({lot.rate}%) ·{" "}
                                    </>
                                  )}
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
                          <p className="text-[11px] text-gray-500">
                            {t("주차면 센서 기준이에요. 공항공사가 구역 이름을 주지 않아 번호로 보여드려요.")}
                          </p>
                          <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                            {zones2.map((z) => {
                              const pct = Math.round((z.free / Math.max(1, z.total)) * 100);
                              return (
                                <li key={z.zone} className="rounded-2xl bg-gray-50 px-3 py-2">
                                  <p className="text-xs text-gray-500">{t("구역 {n}", { n: z.zone })}</p>
                                  <p className="text-sm">
                                    <b className={pct < 10 ? "text-red-700 dark:text-red-400" : pct < 25 ? "text-orange-700 dark:text-orange-400" : "text-emerald-700"}>
                                      {t("{n}면", { n: z.free.toLocaleString() })}
                                    </b>
                                    <span className="text-[11px] text-gray-500"> / {z.total.toLocaleString()}</span>
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
                          <p className="mt-2 text-[11px] text-gray-500">
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
          {/* 외국인 도착 필수품(eSIM·공항철도·리무진·패스)과 공항 투어·교통 상품 (경수님 10/28 '외국어 버전에 잘') */}
          {lang !== "ko" && <TourLinks ko={place.name} en={getT("en")(place.name)} lang={lang} t={t} className="mt-6" picks={AIRPORT_PICKS} />}
          <InlineAd className="mt-6" />
          {zones.length > 0 && avgWait !== null && (
            <FaqBlock
              className="mt-8"
              title={t("자주 묻는 질문")}
              items={[
                {
                  q: t("{name} 출국장 지금 얼마나 기다리나요?", { name: t(place.name) }),
                  a: (() => {
                    const fast = [...zones].filter((z) => z.waitMin !== undefined).sort((a, b) => a.waitMin! - b.waitMin!)[0];
                    return t("{time} 기준 평균 대기 {avg}이에요. 가장 짧은 곳은 {zone}({min})이에요.", {
                      time: `${String(now.hour | 0).padStart(2, "0")}:${String(Math.round((now.hour % 1) * 60)).padStart(2, "0")}`,
                      avg: fmtMinutes(avgWait, t),
                      zone: trZone(fast.label, t),
                      min: fmtMinutes(fast.waitMin!, t),
                    });
                  })(),
                },
                {
                  q: t("{name} 몇 시간 전에 가야 하나요?", { name: t(place.name) }),
                  a: t("지금 평균 대기가 {avg}라서, 국제선은 출발 2시간 30분~3시간 전 도착을 권해요. 붐비는 시간대는 시간대 탭에서 확인하세요.", {
                    avg: fmtMinutes(avgWait, t),
                  }),
                },
              ]}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <EmptyState name="raccoon" pose="wait" size={72}>
      {children}
    </EmptyState>
  );
}
