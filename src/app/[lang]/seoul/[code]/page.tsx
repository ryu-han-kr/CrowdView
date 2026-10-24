import type { Metadata } from "next";
import { StayLinks } from "@/components/StayLinks";
import { CrowdMascot } from "@/components/place/CrowdMascot";
import { AlertButtons } from "@/components/AlertButtons";
import { CalmAlternatives } from "@/components/CalmAlternatives";
import { pushEnabled } from "@/lib/alerts";
import { authEnabled } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "@/i18n/link";
import { LevelBadge } from "@/components/Level";
import { FaqBlock } from "@/components/FaqBlock";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { breadcrumbLd, jsonLd, pageMeta, SITE } from "@/lib/seo";
import { DEFAULT_LANG, localePath } from "@/i18n/config";
import { compactNumber } from "@/lib/format";
import { levelOf, inkOf } from "@/lib/levels";
import { translateNames } from "@/lib/name-translate";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { SEOUL_GROUPS, getSeoulAreaExtra, getSeoulAreaLive, seoulGroup } from "@/lib/seoul-live";
import { getSktCongestion } from "@/lib/skt";
import { GUIDE, GUIDE_KINDS, TOILETS, nearest, areaPhoto, areaPhotoCredit } from "@/lib/seoul-guide";
import { guideNames } from "@/lib/guide-names";
import Image from "next/image";
import { canOptimize } from "@/lib/img";
import { KstNote } from "@/components/LocalTime";
import { Glyph } from "@/components/Glyph";
import { SeoulPeopleProfile } from "@/components/VisitorProfile";
import { UsualBand } from "@/components/UsualBand";
import { TrackRecent } from "@/components/TrackRecent";
import { cellOf } from "@/lib/crowd/model";
import { usualBand } from "@/lib/crowd/percentile";
import { getHolidays } from "@/lib/crowd/signals";
import { kst } from "@/lib/time";
import { EmptyState } from "@/components/EmptyState";
import { InlineAd } from "@/components/AdUnit";

export const revalidate = 600;

// 빌드 때는 한국어만 미리 만들고 다른 언어는 처음 열 때 만든다 (빌드 페이지 약 1,300개 → 500개 아래, Vercel 빌드 시간 절약)
export function generateStaticParams({ params }: { params: { lang: string } }) {
  if (params.lang !== DEFAULT_LANG) return [];
  return SEOUL_AREAS.map((a) => ({ code: a.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; code: string }> }): Promise<Metadata> {
  const { lang, code } = await params;
  const t = getT(lang);
  const area = SEOUL_AREAS.find((a) => a.code === code);
  if (!area) return {};
  const name = (await translateNames([area.name], lang as Lang)).get(area.name) ?? area.name;
  return pageMeta({
    lang,
    path: `/seoul/${code}`,
    title: t("{name} 실시간 인구·혼잡도", { name }),
    description: t("{name}에 지금 몇 명이 있는지, 앞으로 12시간 혼잡 예측과 성별·연령대 (서울시 실시간 도시데이터)", { name }),
  });
}

export default async function SeoulAreaPage({ params }: { params: Promise<{ lang: string; code: string }> }) {
  const { code } = await params;
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const area = SEOUL_AREAS.find((a) => a.code === code);
  if (!area) notFound();
  // 서울시(KT 기반) + SK텔레콤 장소 혼잡도(키가 있을 때)를 함께 보여준다
  const [live, names, skt, extra, holidays] = await Promise.all([
    getSeoulAreaLive(area.code),
    translateNames([area.name], lang),
    getSktCongestion(area.name.replace(/\(.*?\)/g, ""), area.lat, area.lng),
    getSeoulAreaExtra(area.name),
    getHolidays().catch(() => undefined),
  ]);
  // 최근 4주 같은 평일/주말·같은 시간 분포에서 지금 인구가 어디쯤인지 (표본이 모자라면 없음)
  const band = live ? await usualBand("seoul", area.code, Math.round((live.min + live.max) / 2)) : undefined;
  const weekend = cellOf(kst(), holidays) >= 24;
  const BUSY: Record<string, string> = { 한산한: "#10b981", 보통: "#eab308", 분주한: "#f97316", 바쁜: "#ef4444" };
  const name = names.get(area.name) ?? area.name;
  // 숙소 검색어 (해외 사이트용 영어 이름, Papago 캐시)
  const enName = lang === "en" ? name : ((await translateNames([area.name], "en")).get(area.name) ?? area.name);
  // 이 동네 명소·맛집: 그 언어 글이 없는 곳은 이름만 번역 (한국어 노출 방지)
  const toiletCount = nearest(TOILETS, area, (x) => ({ lat: x[1], lng: x[2] }), 50, 0.8).length;
  const spots = nearest(GUIDE, area, (g) => (g.lat && g.lng ? { lat: g.lat, lng: g.lng } : undefined), 6, 1);
  const spotNames = await guideNames(
    spots.map((s) => s.item),
    lang,
  );
  const group = SEOUL_GROUPS.find((g) => g.id === seoulGroup(area.name))!;
  const level = live && levelOf(live.score);
  // 이 지역 사진: 800m 안 가이드 명소의 관광공사 사진 (서울시 데이터에는 사진이 없다)
  const heroImg = areaPhoto(area, true);
  const people = (min: number, max: number) => t("{min}~{max}명", { min: compactNumber(min, lang), max: compactNumber(max, lang) });

  return (
    <main className="px-5 pt-4 pb-10 md:px-0 md:pt-8">
      <TrackRecent id={`seoul-${area.code}`} href={`/seoul/${area.code}`} title={name} img={heroImg} sub={t(group.label)} />
      <Link href="/seoul" className="text-sm text-gray-500">
        ← {t("서울 실시간 인구")}
      </Link>
      <p className="mt-3 text-xs font-medium text-gray-500">
        <Glyph e={group.emoji} /> {t(group.label)} · {t("서울")}
      </p>
      <h1 className="mt-1 text-2xl font-bold md:text-3xl">{name}</h1>
      <KstNote className="mt-1" />
      {heroImg && (
        <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-3xl bg-gray-100 md:aspect-[21/8]">
          <Image
            src={heroImg}
            alt={name}
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 768px) 1100px, 100vw"
            unoptimized={!canOptimize(heroImg)}
            className="object-cover"
          />
          <span className="absolute right-3 bottom-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white">{areaPhotoCredit(area.code) ?? t("주변 사진 · 한국관광공사")}</span>
        </div>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            {
              "@context": "https://schema.org",
              "@type": "Place",
              name,
              url: `${SITE}${localePath(lang, `/seoul/${area.code}`)}`,
              geo: { "@type": "GeoCoordinates", latitude: area.lat, longitude: area.lng },
              address: { "@type": "PostalAddress", addressLocality: "Seoul", addressCountry: "KR" },
            },
            breadcrumbLd(lang, [
              { name: "CrowdView", path: "/" },
              { name: t("서울 실시간 인구"), path: "/seoul" },
              { name, path: `/seoul/${area.code}` },
            ]),
          ]),
        }}
      />
      {/* 한 문장 요약은 아래 인구 카드와 겹쳐 뺐다 (사용자 QA 10/22 — 장소 상세와 같게) */}
      <div className="mt-4 lg:grid lg:grid-cols-2 lg:gap-8">
        <div>
          {live && level ? (
            <section className="rounded-3xl px-4 py-4" style={{ background: `${level.color}24`, boxShadow: `inset 0 0 0 1.5px ${level.color}55` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-gray-800">{t("지금 인구")}</p>
                  {/* 숫자가 길면('2,500~3,000명') 글자를 줄여 '명'이 다음 줄로 혼자 넘어가지 않게 (UI QA 16차) */}
                  <p
                    className={`leading-tight font-black whitespace-nowrap ${people(live.min, live.max).length > 9 ? "text-[24px] md:text-[30px]" : "text-[30px]"}`}
                    style={{ color: inkOf(level.color) }}
                  >
                    {people(live.min, live.max)}
                  </p>
                  <p className="mt-1 text-[17px] font-semibold text-gray-900">
                    {t("서울시 단계")}: <b>{t(live.level)}</b>
                  </p>
                </div>
                <CrowdMascot character="otter" score={live.score} size={104} className="-my-1 shrink-0" label={t(live.level)} />
              </div>
              {band && (
                <p className="mt-1 text-sm font-semibold">
                  <UsualBand band={band.band} weekend={weekend} t={t} />
                </p>
              )}
              {live.message && lang === "ko" && <p className="mt-2 text-[14px] leading-relaxed font-medium text-gray-800">{live.message}</p>}
              <p className="sector-box mt-3 text-[13px] text-gray-700">
                {t("{time} 기준", { time: live.time.slice(11) })} · {t("서울시 실시간 도시데이터")}
              </p>
            </section>
          ) : (
            <EmptyState name="otter" pose="wait">{t("지금은 서울시 데이터를 받지 못했어요. 잠시 후 다시 확인해 주세요.")}</EmptyState>
          )}

          {skt && (
            <section className="mt-3 flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3">
              <div>
                <p className="text-xs text-gray-500">{t("SK텔레콤 장소 혼잡도")}</p>
                <p className="text-sm font-semibold">{skt.poiName}</p>
              </div>
              <LevelBadge score={skt.score} />
            </section>
          )}

          {extra?.commerce && (
            <section className="mt-4 rounded-3xl border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold">
                  <Glyph e="💳" className="h-4 w-4 text-indigo-500" /> {t("지금 가게들은")}
                </h2>
                <span className="text-xs font-bold" style={{ color: inkOf(BUSY[extra.commerce.level] ?? "#6b7280") }}>
                  {t("상권 전체 '{level}'", { level: t(extra.commerce.level) })}
                </span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {[...extra.commerce.categories]
                  .sort((a, b) => Object.keys(BUSY).indexOf(b.level) - Object.keys(BUSY).indexOf(a.level))
                  .map((c) => (
                    <li
                      key={c.name}
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ color: inkOf(BUSY[c.level] ?? "#6b7280"), background: `${BUSY[c.level] ?? "#6b7280"}14` }}
                    >
                      {t(c.name)} · {t(c.level)}
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-[11px] text-gray-500">{t("카드 결제 건수로 본 업종별 붐빔 (서울시 실시간 도시데이터)")}</p>
              {(extra.road || extra.bikes) && (
                <p className="mt-3 text-xs text-gray-600">
                  {extra.road && (
                    <>
                      <Glyph e="🚗" /> {t("주변 도로")} {t(extra.road.index)} ({extra.road.speed}km/h)
                    </>
                  )}
                  {extra.road && extra.bikes ? " · " : ""}
                  {extra.bikes ? (
                    <>
                      <Glyph e="🚲" /> {t("따릉이 {n}대", { n: extra.bikes })}
                    </>
                  ) : null}
                </p>
              )}
            </section>
          )}

          {live?.profile && <SeoulPeopleProfile profile={live.profile} lang={lang} />}
          {(() => {
            const toilets = toiletCount;
            return (
              <section className="mt-4 rounded-3xl border border-gray-100 p-4">
                <Link
                  href={`/near?tab=toilet&lat=${area.lat}&lng=${area.lng}&name=${encodeURIComponent(name)}`}
                  className="flex items-center justify-between text-sm font-semibold"
                >
                  <span>
                    <Glyph e="🚻" /> {t("800m 안 공중화장실 {n}곳", { n: toilets })}
                  </span>
                  <span className="text-indigo-600">{t("보기")} ›</span>
                </Link>
                {spots.length > 0 && (
                  <>
                    <p className="mt-4 text-sm font-bold">{t("이 동네 명소·맛집")}</p>
                    <ul className="mt-2 grid grid-cols-2 gap-2">
                      {spots.map(({ item: g }) => (
                        <li key={g.id}>
                          <Link href={`/guide/${g.id}`} className="block truncate rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold">
                            {GUIDE_KINDS.find((k) => k.id === g.kind)?.emoji} {spotNames.get(g.id)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            );
          })()}
          <AlertButtons placeId={`seoul-${area.code}`} enabled={authEnabled && pushEnabled} />
          <CalmAlternatives character="otter" lat={area.lat} lng={area.lng} score={live?.score} selfId={`seoul-${area.code}`} lang={lang} />
          <StayLinks ko={area.name} en={enName} lang={lang} t={t} at={area} className="mt-4" />
          <InlineAd className="mt-6" />
          <a
            href={`https://map.naver.com/p/search/${encodeURIComponent(area.name)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm font-semibold text-indigo-600"
          >
            {t("지도 보기")} ›
          </a>
        </div>

        {live && live.forecast.length > 0 && (
          <section className="mt-6 lg:mt-0">
            <h2 className="text-lg font-bold">{t("앞으로 12시간")}</h2>
            <p className="text-xs text-gray-500">{t("서울시 AI 예측 인구")}</p>
            <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {live.forecast.map((f) => (
                <li key={f.time} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-14 shrink-0 font-semibold">{f.time.slice(11, 16)}</span>
                  <span className="min-w-0 flex-1 text-gray-600">{people(f.min, f.max)}</span>
                  <LevelBadge score={f.score} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {live && (
        <FaqBlock
          className="mt-8"
          title={t("자주 묻는 질문")}
          items={[
            {
              q: t("지금 {name}에 사람이 얼마나 있나요?", { name }),
              a: t("{time} 기준 {name} 일대에는 약 {range}이 있어요. 서울시 혼잡 단계는 '{level}'이에요.", {
                time: live.time.slice(11),
                name,
                range: people(live.min, live.max),
                level: t(live.level),
              }),
            },
            ...(live.forecast.length
              ? [
                  {
                    q: t("{name} 오늘 언제 가장 한산한가요?", { name }),
                    a: (() => {
                      // 새벽처럼 다니기 어려운 시간은 빼고 08~21시 안에서만 고른다
                      const daytime = live.forecast.filter((f) => {
                        const h = Number(f.time.slice(11, 13));
                        return h >= 8 && h <= 21;
                      });
                      const calm = [...daytime].sort((a, b) => a.min - b.min)[0];
                      if (!calm) return t("앞으로 12시간 안에는 낮 시간대(08~21시) 예측이 없어요. 내일 다시 확인해 주세요.");
                      return t("앞으로 12시간 중 낮 시간대(08~21시)에는 {hour}쯤이 가장 한산할 것으로 예상돼요 (서울시 공식 예측, 약 {range}).", {
                        hour: calm.time.slice(11, 16),
                        range: people(calm.min, calm.max),
                      });
                    })(),
                  },
                ]
              : []),
          ]}
        />
      )}
      <p className="mt-8 text-center text-[11px] text-gray-500">{t("서울시 실시간 도시데이터 (통신사 기지국 기반 추정 인구)")}</p>
    </main>
  );
}
