import Link from "@/i18n/link";
import { StayLinks } from "@/components/StayLinks";
import type { Metadata } from "next";
import { jsonLd, pageMeta, SITE } from "@/lib/seo";
import { getSktCongestion } from "@/lib/skt";
import { notFound } from "next/navigation";
import { DataTag } from "@/components/DataTag";
import { LevelBadge } from "@/components/Level";
import { FESTIVAL_CATEGORIES, FESTIVAL_STEPS, getFestival, getFestivalCrowd, getFestivalLive, isLongRunning, seoulAreaOf } from "@/lib/festivals";
import { compactNumber } from "@/lib/format";
import { LEVELS, levelOf } from "@/lib/levels";
import { daysUntil, kst } from "@/lib/time";
import type { Lang } from "@/i18n/config";
import { fmtPeople, trRegion } from "@/i18n/patterns";
import { getT } from "@/i18n/server";
import { translateNames } from "@/lib/name-translate";
import { formatHour } from "@/i18n/translate";
import { KstNote } from "@/components/LocalTime";
import { Glyph } from "@/components/Glyph";

export const revalidate = 3600;

const pct = (r: number) => `${r >= 1 ? "+" : ""}${Math.round((r - 1) * 100)}%`;
/** 많았어요/적었어요 문장용: 부호 없이 */
const pctAbs = (r: number) => `${Math.abs(Math.round((r - 1) * 100))}%`;

export async function generateMetadata({ params }: { params: Promise<{ id: string; lang: string }> }): Promise<Metadata> {
  const { id, lang } = await params;
  const f = await getFestival(id);
  if (!f) return {};
  const t = getT(lang);
  const names = await translateNames([f.title, f.region], lang as Lang);
  const title = names.get(f.title) ?? f.title;
  const region = names.get(f.region) ?? f.region;
  return pageMeta({
    lang,
    path: `/festival/${id}`,
    title: t("{name} 혼잡도·일정", { name: title }),
    description: t("{name} ({start}~{end}, {region}) 예상 혼잡도와 일정, 장소, 날씨", { name: title, start: f.start, end: f.end, region }),
    image: f.image,
  });
}

export default async function FestivalPage({ params }: { params: Promise<{ id: string; lang: string }> }) {
  const { id } = await params;
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const f = await getFestival(id);
  if (!f) notFound();
  const [crowd, live] = await Promise.all([getFestivalCrowd(f), getFestivalLive(f)]);
  const area = seoulAreaOf(f);
  // 서울시 데이터가 없는 진행 중 축제는 SK 장소 혼잡도 (키가 있을 때만)
  const today0 = kst().date;
  const skt =
    !live && !area && f.lat && f.lng && f.start <= today0 && f.end >= today0
      ? await getSktCongestion(f.title.replace(/\[[^\]]*\]|\d{4}년?|제?\d+회/g, "").trim(), f.lat, f.lng)
      : undefined;
  // 축제 이름·장소·지역명 번역 (Papago, Redis 캐시). 못 하면 원문
  const names = await translateNames([f.title, f.place, f.region, crowd?.signguName, live?.area, area?.name], lang);
  const tr = (ko: string) => names.get(ko) ?? ko;
  // 숙소 검색어: 축제 지역(시군구). 해외 사이트용 영어 이름 (Papago 캐시)
  const enRegion = (await translateNames([f.region], "en")).get(f.region) ?? f.region;
  const translated = names.has(f.title);
  const today = kst().date;
  const dday = daysUntil(f.start);
  const ongoing = f.start <= today && f.end >= today;
  const level = crowd && levelOf(crowd.score);
  const cat = FESTIVAL_CATEGORIES.find((c) => c.id === f.category)!;
  const mapUrl = `https://map.naver.com/p/search/${encodeURIComponent(`${f.title} ${f.region}`)}`;

  return (
    <main className="px-5 pt-4 pb-10 md:px-0 md:pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "Festival",
            name: tr(f.title),
            startDate: f.start,
            endDate: f.end,
            eventStatus: "https://schema.org/EventScheduled",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            location: {
              "@type": "Place",
              name: f.place || f.region,
              address: { "@type": "PostalAddress", streetAddress: f.place, addressRegion: f.region, addressCountry: "KR" },
              ...(f.lat && f.lng && { geo: { "@type": "GeoCoordinates", latitude: f.lat, longitude: f.lng } }),
            },
            ...(f.image && { image: [f.image] }),
            ...(f.link && { url: f.link }),
            ...(f.fee && { isAccessibleForFree: /무료/.test(f.fee) }),
            organizer: { "@type": "Organization", name: f.source === "tourapi" ? "한국관광공사 TourAPI" : "서울특별시", url: SITE },
          }),
        }}
      />
      <Link href="/events" className="text-sm text-gray-500">
        ← {t("축제 목록")}
      </Link>

      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10">
        <div>
          <div className="relative h-56 overflow-hidden rounded-3xl bg-gray-100 md:h-80">
            {f.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.image} alt={tr(f.title)} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-indigo-300">
                <Glyph e={cat.emoji} className="h-20 w-20" />
              </div>
            )}
            <span className="absolute right-2 bottom-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/90">
              {f.source === "tourapi" ? t("사진 한국관광공사") : t("사진 서울시 문화행사 정보")}
            </span>
          </div>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <Link href={`/events?type=${cat.id}`} className="text-xs font-semibold text-indigo-600">
                <Glyph e={cat.emoji} /> {t(cat.label)}
              </Link>
              <h1 className="text-2xl font-bold md:text-3xl">{tr(f.title)}</h1>
              <KstNote className="mt-1" />
              {lang !== "ko" && (
                <p className="mt-1 text-xs text-gray-400">
                  {translated
                    ? `${f.title} · ${t("이름·장소는 Papago 자동 번역이에요. 요금은 한국어 원문이에요.")}`
                    : t("축제 이름·장소·요금은 주최 측 원문(한국어)이에요.")}
                </p>
              )}
            </div>
            <span className="mt-1 shrink-0 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
              {ongoing ? t("진행 중") : dday > 0 ? `D-${dday}` : t("종료")}
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label={t("기간")}>
              {f.start}
              {f.end !== f.start && ` ~ ${f.end}`}
            </Row>
            <Row label={t("장소")}>
              {f.place ? tr(f.place) : (names.get(f.region) ?? trRegion(f.region, t))}
              <a href={mapUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs font-semibold text-indigo-600">
                {t("지도 보기")} ›
              </a>
            </Row>
            {f.fee && <Row label={t("요금")}>{f.fee}</Row>}
            {f.tel && <Row label={t("문의")}>{f.tel}</Row>}
            {f.link && (
              <Row label={t("홈페이지")}>
                <a href={f.link} target="_blank" rel="noreferrer" className="break-all text-indigo-600 underline">
                  {f.link}
                </a>
              </Row>
            )}
          </dl>
        </div>

        <div className="mt-6 lg:mt-0">
          {live && (
            <section className="mb-4 rounded-3xl p-5" style={{ background: `${levelOf(live.score).color}14` }}>
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <span className="rounded bg-emerald-600 px-1.5 py-px text-[10px] font-bold text-white">{t("실시간")}</span>
                {t("지금 {area} 일대", { area: tr(live.area) })}
              </p>
              <p className="mt-1 text-2xl font-extrabold" style={{ color: levelOf(live.score).color }}>
                {t(levelOf(live.score).label)}
                <span className="ml-2 text-base font-semibold text-gray-900">
                  {t("{min}~{max}명", { min: compactNumber(live.min, lang), max: compactNumber(live.max, lang) })}
                </span>
              </p>
              {live.forecast.length > 0 && (
                <ul className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                  {live.forecast.slice(0, 8).map((p) => (
                    <li key={p.time} className="w-16 shrink-0 rounded-xl bg-white/80 py-1.5 text-center">
                      <p className="text-[10px] text-gray-500">{formatHour(Number(p.time.slice(11, 13)), lang)}</p>
                      <p className="text-xs font-bold" style={{ color: levelOf(p.score).color }}>
                        {t(levelOf(p.score).label)}
                      </p>
                      <p className="text-[10px] text-gray-500">{compactNumber(Math.round((p.min + p.max) / 2), lang)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-gray-400">
                {t("서울시 실시간 도시데이터")} · {t("서울시 단계 ‘{level}’", { level: t(live.level) })} · {t("{time} 기준", { time: live.time })} ·{" "}
                {t("축제 장소에서 {m}m 떨어진 실시간 지역", { m: live.distance })}
              </p>
            </section>
          )}
          {skt && (
            <section className="mb-4 rounded-3xl p-5" style={{ background: `${levelOf(skt.score).color}14` }}>
              <p className="text-xs font-medium text-gray-500">
                <span className="mr-1 rounded bg-emerald-600 px-1 py-px text-[10px] font-bold text-white">{t("실시간")}</span>
                {t("지금 {area} 일대", { area: skt.poiName })}
              </p>
              <p className="mt-1 text-2xl font-extrabold" style={{ color: levelOf(skt.score).color }}>
                {t(levelOf(skt.score).label)}
              </p>
              <p className="mt-2 text-[11px] text-gray-400">
                {t("SK텔레콤 장소 혼잡도")} {skt.time && `· ${t("{time} 기준", { time: skt.time.slice(11) })}`}
              </p>
            </section>
          )}
          {!live && area && (
            <p className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
              {t("이 축제는 서울시 실시간 지역 ‘{area}’ 안에서 열려요. 축제가 시작되면 실시간 인구를 보여드려요.", { area: tr(area.name) })}
            </p>
          )}
          <section className="rounded-3xl p-5" style={{ background: level ? `${level.color}14` : "#f9fafb" }}>
            <p className="text-xs font-medium text-gray-500">
              {t("지역 방문 증가 예상 (시군구 기준)")}
              <DataTag />
            </p>
            {crowd && level ? (
              <>
                <p className="mt-1 text-2xl font-extrabold" style={{ color: level.color }}>
                  {t(level.label)}
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {t(
                    crowd.ratio >= 1
                      ? "작년 이 기간 {area} 방문객이 평소보다 {pct} 많았어요"
                      : "작년 이 기간 {area} 방문객이 평소보다 {pct} 적었어요",
                    {
                      area: tr(crowd.signguName),
                      pct: pctAbs(crowd.ratio),
                    },
                  )}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">
                  {t("축제장 안의 인원이나 대기시간이 아니라 {area} 전체 방문객 통계예요.", { area: tr(crowd.signguName) })}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-600">
                {isLongRunning(f)
                  ? t("한 달 넘게 이어지는 상설·장기 행사라 특정일 혼잡 예측은 하지 않아요.")
                  : t("이 지역의 작년 방문객 데이터가 없어 예측하지 못했어요.")}
              </p>
            )}
          </section>

          {crowd && (
            <section className="mt-4 rounded-2xl border border-gray-100 p-4 text-sm">
              <h2 className="font-bold">{t("이렇게 예측했어요")}</h2>
              <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
                <li>
                  ·{" "}
                  {t("작년 같은 요일 기간 ({range}) {area} 외지인·외국인 방문객 하루 평균", {
                    range: `${crowd.days[0].slice(5)}${crowd.days.length > 1 ? ` ~ ${crowd.days.at(-1)!.slice(5)}` : ""}`,
                    area: tr(crowd.signguName),
                  })}{" "}
                  <b>{fmtPeople(crowd.festivalAvg, t, lang)}</b>
                </li>
                <li>
                  · {t("평소 (그 전 4주 같은 요일) 하루 평균")} <b>{fmtPeople(crowd.baselineAvg, t, lang)}</b> →{" "}
                  <b>{t("{n}배", { n: crowd.ratio.toFixed(2) })}</b>
                </li>
                <li>· {t("시군구 전체 기준이라 작은 축제는 변화가 작게 나올 수 있어요.")}</li>
              </ul>
              <div className="mt-3 flex overflow-hidden rounded-lg text-center text-[10px] leading-tight">
                {LEVELS.map((l, i) => (
                  <div key={l.key} className="flex-1 py-1.5" style={{ background: `${l.color}1f`, color: l.color }}>
                    <b>{t(l.label)}</b>
                    <br />
                    {i === 0 ? `~${pct(FESTIVAL_STEPS[0])}` : i === 4 ? `${pct(FESTIVAL_STEPS[3])}+` : `~${pct(FESTIVAL_STEPS[i])}`}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">{t("출처: 한국관광공사 데이터랩 (이동통신 방문자, 시군구 일별)")}</p>
            </section>
          )}

          {crowd && level && (
            <p className="mt-4 text-xs text-gray-500">
              <LevelBadge score={crowd.score} /> {t("은 평소 대비 방문객 증가율로 정한 단계예요.")}
            </p>
          )}
          <StayLinks ko={f.region} en={enRegion} lang={lang} t={t} className="mt-6" />
        </div>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-14 shrink-0 text-gray-400">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
