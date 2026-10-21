import type { Metadata } from "next";
import spotImages from "@/data/korea/spot-images.json";
import { notFound } from "next/navigation";
import { CalmAlternatives } from "@/components/CalmAlternatives";
import { StayLinks } from "@/components/StayLinks";
import Link from "@/i18n/link";
import { DEFAULT_LANG, type Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { getAllCrowd } from "@/lib/crowd/service";
import { distanceKm } from "@/lib/geo";
import { LANDMARKS, LANDMARK_KINDS, landmarkMapHref } from "@/lib/korea";
import { LANDMARK_INFO } from "@/lib/landmark-info";
import { PLACES, placeHref } from "@/lib/places";
import { breadcrumbLd, jsonLd, pageMeta, SITE } from "@/lib/seo";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { getAllSeoulLive } from "@/lib/seoul-live";
import { KstNote } from "@/components/LocalTime";
import { Glyph } from "@/components/Glyph";
import { PlaceHero } from "@/components/PlaceHero";
import { WeatherCard } from "@/components/WeatherCard";
import { formatHour } from "@/i18n/translate";
import { DailyForecastChart } from "@/components/DailyForecastChart";
import { HourlyChart } from "@/components/HourlyChart";
import { CrowdGauge } from "@/components/CrowdGauge";
import { WeekHeatmap } from "@/components/WeekHeatmap";
import { DataTag } from "@/components/DataTag";
import { levelOf, inkOf } from "@/lib/levels";
import { spotForecast } from "@/lib/spot-model";
import spotKto from "@/data/korea/spot-kto.json";
import { getConcentration } from "@/lib/crowd/signals";
import { kst } from "@/lib/time";
import { compactNumber } from "@/lib/format";

const SPOT_KTO = spotKto as Record<string, { areaCd: string; signguCd: string; name: string }>;

// 명소마다 관광공사 사진 여러 장 (scripts/korea-data/gallery.mts)
const SPOT_IMAGES = spotImages as Record<string, string[]>;

// 대표 명소 66곳 상세 (외부 검토: 얇은 페이지 대량 생성 대신 고른 명소만). 소개·이용 정보는 한국관광공사 자료,
// 혼잡도는 가까운 우리 장소·서울 실시간 지역이 있을 때만 붙인다 (없으면 없다고 쓴다)
export const revalidate = 600;

// 빌드 때는 한국어만 미리 만들고 다른 언어는 처음 열 때 만든다 (빌드 페이지 약 1,300개 → 500개 아래, Vercel 빌드 시간 절약)
export function generateStaticParams({ params }: { params: { lang: string } }) {
  if (params.lang !== DEFAULT_LANG) return [];
  return LANDMARKS.map((l) => ({ id: l.id }));
}

/** 소개 글 첫 문장 (설명·요약용, 최대 140자) */
const firstSentence = (s: string) => {
  const one = s.split(/(?<=다\.)\s/)[0] ?? s;
  return one.length > 140 ? `${one.slice(0, 139)}…` : one;
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang, id } = await params;
  const l = LANDMARKS.find((x) => x.id === id);
  if (!l) return {};
  const t = getT(lang);
  const name = l.n[lang as Lang] ?? l.n.ko;
  const info = LANDMARK_INFO[id];
  return pageMeta({
    lang,
    path: `/spot/${id}`,
    title: t("{name} 여행 정보·혼잡도", { name }),
    description: lang === "ko" && info ? firstSentence(info.overview) : t("{name} 소개, 이용 시간, 쉬는 날, 근처 혼잡도와 숙소", { name }),
    image: l.img,
    // 소개 글이 한국어뿐이라 외국어 화면은 아직 검색에 올리지 않는다 (외국어 관광공사 자료 신청 후 공개)
    noindex: lang !== "ko",
  });
}

export default async function SpotPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { id } = await params;
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const l = LANDMARKS.find((x) => x.id === id);
  if (!l) notFound();
  const info = LANDMARK_INFO[id];
  const name = l.n[lang] ?? l.n.ko;
  const photos = [...new Set([l.img, ...(SPOT_IMAGES[id] ?? []), ...(info?.images ?? [])])];
  const kind = LANDMARK_KINDS.find((k) => k.id === l.kind)!;
  const paras = (info?.overview ?? "").split("\n").filter((x) => x.trim());
  const intro = paras.slice(0, 1).join("\n");
  const rest = paras.slice(1).join("\n");

  // 지금 혼잡도: 1.5km 안 우리 장소 → 0.8km 안 서울 실시간 지역
  const [crowd, seoul] = await Promise.all([
    getAllCrowd().catch(() => ({}) as Awaited<ReturnType<typeof getAllCrowd>>),
    getAllSeoulLive().catch(() => ({}) as Awaited<ReturnType<typeof getAllSeoulLive>>),
  ]);
  const place = PLACES.find((p) => p.category !== "airport" && distanceKm(p, l) < 1.5);
  const area = l.region === "서울" ? SEOUL_AREAS.find((a) => distanceKm(a, l) < 0.8) : undefined;
  const live: { score: number; href: string; label: string; open: boolean } | undefined =
    place && crowd[place.id]
      ? { score: crowd[place.id].score, href: placeHref(place), label: t(place.name), open: crowd[place.id].open }
      : area && seoul[area.code]
        ? { score: seoul[area.code].score, href: `/seoul/${area.code}`, label: area.name, open: true }
        : undefined;

  // 관광공사 관광지 집중률 30일 예측 (scripts/korea-data/spot-kto.mts로 찾은 이름, 6시간 캐시)
  const kto = SPOT_KTO[id];
  const rates = kto ? await getConcentration(kto).catch(() => new Map<string, number>()) : new Map<string, number>();
  const daily = [...rates.entries()]
    .filter(([d]) => d >= kst().date)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 30)
    .map(([date, value]) => ({ date, value }));
  const weekday = (date: string) => new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  // 가까운 우리 장소가 있으면 그곳의 오늘 시간대별 곡선
  const near = place && crowd[place.id];
  const nearHourly = near
    ? { points: near.hourly, estimated: near.source === "model", unit: (place.criteria?.unit === "분" ? "분" : "명") as "명" | "분" }
    : undefined;

  // 예측 모델 (근처 실시간이 없어도 모든 명소에 지금 추정·오늘 곡선·이번 주 히트맵)
  const model = await spotForecast(l);
  const nowScore = live ? live.score : model.now.score;
  const nowOpen = live ? live.open : model.now.open;
  const nowLevel = levelOf(nowScore);
  // 오늘 남은 운영 시간 중 가장 한산한 시각 (입장 마감 1시간 전까지)
  const last = model.place.hours[1] >= 24 ? 23 : model.place.hours[1] - 2;
  const best = (nearHourly?.points ?? model.now.hourly)
    .filter((p) => p.forecast && p.hour >= model.place.hours[0] && p.hour <= last)
    .sort((a, b) => a.score - b.score)[0];

  const others = LANDMARKS.filter((x) => x.region === l.region && x.id !== l.id)
    .sort((a, b) => distanceKm(a, l) - distanceKm(b, l))
    .slice(0, 6);
  const rows: [string, string | undefined][] = [
    [t("주소"), info?.addr],
    [t("이용 시간"), info?.usetime],
    [t("쉬는 날"), info?.restdate],
    [t("주차"), info?.parking],
    [t("문의"), info?.tel],
  ];

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            {
              "@context": "https://schema.org",
              "@type": "TouristAttraction",
              name,
              ...(info && { description: firstSentence(info.overview), address: info.addr }),
              image: photos.slice(0, 4),
              geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lng },
              url: `${SITE}${lang === "ko" ? "" : `/${lang}`}/spot/${id}`,
              ...(info?.homepage && { sameAs: info.homepage }),
            },
            breadcrumbLd(lang, [
              { name: "CrowdView", path: "/" },
              { name: t("지역 여행"), path: "/explore" },
              { name, path: `/spot/${id}` },
            ]),
          ]),
        }}
      />
      {/* 위 사진: 장소 상세와 같은 전체 폭 사진 + 뒤로 버튼 (관광공사 사진 5~12장 넘겨 보기) */}
      <PlaceHero place={{ ...model.place, name, image: undefined, emoji: kind.emoji }} gallery={photos} favorite={false} />

      {/* 장소 상세와 같은 틀: 모바일은 한 줄, PC는 왼쪽(지금·날씨) 고정 + 오른쪽(그래프·소개) */}
      <div className="relative -mt-6 px-5 pb-10 md:mt-8 md:px-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-10">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              <Glyph e={kind.emoji} className="mr-0.5 h-3.5 w-3.5" />
              {t(kind.label)}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{t(l.region)}</span>
          </div>
          <h1 className="mt-2 text-[26px] leading-tight font-extrabold tracking-tight md:text-3xl">{name}</h1>
          {lang !== "ko" && <p className="mt-0.5 text-sm text-gray-500">{l.n.ko}</p>}
          {info?.overview && (
            <p lang="ko" className="mt-2 text-[15px] leading-7 text-gray-600">
              {firstSentence(info.overview)}
            </p>
          )}
          {/* 한 문장 요약 (장소 상세와 같은 상자) */}
          <p className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-[15px] leading-7 text-gray-800">
            {nowOpen
              ? t("{name}의 지금 혼잡도는 ‘{level}’이에요.", { name, level: t(nowLevel.label) })
              : t("{name}은(는) 지금 운영 시간이 아니에요.", { name })}
            {best && ` ${t("오늘 남은 운영 시간 중에는 {hour}쯤이 가장 한산할 것으로 보여요.", { hour: formatHour(best.hour, lang) })}${levelOf(best.score).key >= 4 ? ` ${t("다만 그때도 ‘{level}’ 예상이라 한산하다는 뜻은 아니에요.", { level: t(levelOf(best.score).label) })}` : ""}`}
          </p>
          <KstNote className="mt-1" />

          {/* 지금 혼잡도 (장소 상세와 같은 모양: 단계 + 반원 계기판) */}
          <section className="mt-4 rounded-3xl px-4 py-3.5" style={{ background: `${nowOpen ? nowLevel.color : "#6b7280"}14` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-600">{t("지금 혼잡도")}</p>
                <p className="text-[28px] leading-tight font-extrabold" style={{ color: nowOpen ? inkOf(nowLevel.color) : "#4b5563" }}>
                  {nowOpen ? t(nowLevel.label) : t("운영 시간 아님")}
                  {!live && nowOpen && <DataTag className="text-xs" />}
                </p>
                <p className="mt-0.5 text-base text-gray-700">{t(nowOpen ? nowLevel.desc : "운영 시간 {from} ~ {to}", { from: formatHour(model.place.hours[0], lang), to: formatHour(model.place.hours[1], lang) })}</p>
              </div>
              <CrowdGauge score={nowScore} closed={!nowOpen} size={120} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {live ? (
                <Link href={live.href} className="underline">
                  {t("가까운 측정 지점 {name} 기준", { name: live.label })} ›
                </Link>
              ) : (
                t("요일·시간·날씨·관광공사 예측으로 본 CrowdView 추정")
              )}
            </p>
          </section>

          <WeatherCard signals={model.signals} lang={lang} place={model.place} />
          {nowOpen && (
            <CalmAlternatives lat={l.lat} lng={l.lng} score={nowScore} selfId={place ? place.id : area ? `seoul-${area.code}` : `spot-${l.id}`} lang={lang} />
          )}
          <a
            href={landmarkMapHref(l, lang)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block rounded-2xl border border-gray-200 bg-white py-3 text-center text-sm font-semibold"
          >
            <Glyph e="🗺️" /> {t("지도에서 보기")}
          </a>
        </div>

        <div className="lg:[&>*:first-child]:mt-0">
          {/* 순서: 장소 상세와 같게 — 오늘 시간대별 → 언제 가면 한산할까 → (월별 대신) 앞으로 30일 */}
          <section className="mt-8">
            <h2 className="text-lg font-bold">
              {t("오늘 시간대별")}
              {!nearHourly && <DataTag />}
            </h2>
            <div className="mt-4">
              {nearHourly ? (
                <HourlyChart points={nearHourly.points} highlightHour={Math.floor(kst().hour)} estimated={nearHourly.estimated} unit={nearHourly.unit} />
              ) : (
                <HourlyChart points={model.now.hourly} highlightHour={Math.floor(kst().hour)} estimated />
              )}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">
              {t("언제 가면 한산할까")}
              <DataTag />
            </h2>
            <p className="mt-0.5 mb-3 text-sm text-gray-500">{t("이번 주 시간대별 예상 혼잡 · 초록 칸이 한산해요")}</p>
            <WeekHeatmap
              nowHour={kst().hour}
              days={model.week.map((d, i) => ({
                date: d.date,
                label: i === 0 ? t("오늘") : i === 1 ? t("내일") : weekday(d.date),
                closed: d.closed,
                hours: d.points.map((p) => ({ hour: p.hour, score: p.score })),
              }))}
            />
          </section>

          {/* 작년 이맘때 시군구 방문객 (관광공사 데이터랩, 외지인·외국인, 작년 같은 요일) — 실제 숫자 */}
          {model.lastYear && model.lastYear.days.length > 1 && (() => {
            const days = model.lastYear.days;
            const max = Math.max(...days.map((d) => d.visitors));
            const avg = Math.round(days.reduce((a, d) => a + d.visitors, 0) / days.length);
            const top = days.reduce((a, d) => (d.visitors > a.visitors ? d : a), days[0]);
            return (
              <section className="mt-8">
                <h2 className="text-lg font-bold">{t("작년 이맘때 {region} 방문객", { region: t(model.lastYear.region) })}</h2>
                <p className="mt-0.5 text-sm text-gray-500">{t("관광공사 데이터랩 · 다른 지역에서 온 사람과 외국인, 작년 같은 요일")}</p>
                <p className="mt-2 text-[15px]">
                  {t("하루 평균 약 {n}명, {day}이 가장 많았어요 (약 {m}명).", {
                    n: compactNumber(avg, lang),
                    day: new Intl.DateTimeFormat(lang, { weekday: "long", timeZone: "UTC" }).format(new Date(`${top.date}T00:00:00Z`)),
                    m: compactNumber(top.visitors, lang),
                  })}
                </p>
                <ul className="mt-3 flex h-32 items-end gap-1.5">
                  {days.map((d) => (
                    <li key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                      <span className="mb-1 text-[11px] text-gray-600 tabular-nums">{compactNumber(d.visitors, lang)}</span>
                      <span
                        className="block w-full rounded-lg"
                        style={{ height: `${Math.max(8, (d.visitors / max) * 100)}%`, background: d === top ? "#6366f1" : "#c7d2fe" }}
                      />
                      <span className="mt-1 text-xs text-gray-600">{weekday(d.date)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()}

          <section className="mt-8">
            <h2 className="text-lg font-bold">{t("앞으로 30일 붐빔 예측")}</h2>
            {daily.length > 1 ? (
              <>
                <p className="mt-0.5 mb-3 text-sm text-gray-500">{t("한국관광공사 관광지 집중률 예측 · 그래프를 눌러 날짜별로 보기")}</p>
                <DailyForecastChart days={daily} weekdays={daily.map((d) => weekday(d.date))} />
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-500">{t("관광공사 예측 자료가 아직 없는 곳이에요.")}</p>
            )}
          </section>

          {info?.overview && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">{t("소개")}</h2>
              {lang !== "ko" && <p className="mt-1 text-xs text-gray-500">{t("소개 글은 한국관광공사의 한국어 자료예요.")}</p>}
              {/* 긴 소개는 첫 단락만 보이고 나머지는 펼쳐 보기 (글만 길게 늘어서지 않게) */}
              <p lang="ko" className="mt-2 text-[15px] leading-7 whitespace-pre-line text-gray-700">
                {intro}
              </p>
              {rest && (
                <details className="group mt-1">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-indigo-600 group-open:hidden">{t("더보기")}</summary>
                  <p lang="ko" className="mt-1 text-[15px] leading-7 whitespace-pre-line text-gray-700">
                    {rest}
                  </p>
                </details>
              )}
            </section>
          )}

          <StayLinks ko={l.n.ko} en={l.n.en} lang={lang} t={t} at={l} className="mt-6" />

          {others.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">{t("{region}의 다른 명소", { region: t(l.region) })}</h2>
              <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-100">
                {others.map((o) => (
                  <li key={o.id}>
                    <Link href={`/spot/${o.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50">
                      <span className="truncate font-semibold">{o.n[lang] ?? o.n.ko}</span>
                      <span className="shrink-0 text-xs text-gray-500">{t("{km}km", { km: distanceKm(o, l).toFixed(0) })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 정보 (장소 상세와 같은 자리·모양) */}
          <section className="mt-8 space-y-3 text-sm">
            <h2 className="text-lg font-bold">{t("정보")}</h2>
            {rows
              .filter((r): r is [string, string] => !!r[1])
              .map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="w-16 shrink-0 text-gray-500">{k}</span>
                  <span lang="ko" className="min-w-0 whitespace-pre-line text-gray-800">
                    {v}
                  </span>
                </div>
              ))}
            {info?.homepage && (
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-gray-500">{t("홈페이지")}</span>
                <a href={info.homepage} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-indigo-600 underline">
                  {info.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </div>
            )}
            <p className="pt-1 text-xs text-gray-500">{t("자료: 한국관광공사. 방문 전 공식 안내를 확인하세요.")}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
