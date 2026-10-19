import type { Metadata } from "next";
import { StayLinks } from "@/components/StayLinks";
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
import { localePath } from "@/i18n/config";
import { compactNumber } from "@/lib/format";
import { levelOf } from "@/lib/levels";
import { translateNames } from "@/lib/name-translate";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { SEOUL_GROUPS, getSeoulAreaExtra, getSeoulAreaLive, seoulGroup } from "@/lib/seoul-live";
import { getSktCongestion } from "@/lib/skt";
import { GUIDE, GUIDE_KINDS, TOILETS, guideText, nearest, photoNear } from "@/lib/seoul-guide";
import Image from "next/image";
import { canOptimize } from "@/lib/img";
import { KstNote } from "@/components/LocalTime";
import { Glyph } from "@/components/Glyph";

export const revalidate = 600;

export function generateStaticParams() {
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
  const [live, names, skt, extra] = await Promise.all([
    getSeoulAreaLive(area.code),
    translateNames([area.name], lang),
    getSktCongestion(area.name.replace(/\(.*?\)/g, ""), area.lat, area.lng),
    getSeoulAreaExtra(area.name),
  ]);
  const BUSY: Record<string, string> = { 한산한: "#10b981", 보통: "#eab308", 분주한: "#f97316", 바쁜: "#ef4444" };
  const name = names.get(area.name) ?? area.name;
  // 숙소 검색어 (해외 사이트용 영어 이름, Papago 캐시)
  const enName = lang === "en" ? name : ((await translateNames([area.name], "en")).get(area.name) ?? area.name);
  const group = SEOUL_GROUPS.find((g) => g.id === seoulGroup(area.name))!;
  const level = live && levelOf(live.score);
  // 이 지역 사진: 800m 안 가이드 명소의 관광공사 사진 (서울시 데이터에는 사진이 없다)
  const heroImg = photoNear(area, 0.8, true);
  const people = (min: number, max: number) => t("{min}~{max}명", { min: compactNumber(min, lang), max: compactNumber(max, lang) });
  const maxAge = live?.profile ? Math.max(...live.profile.ages, 1) : 1;

  return (
    <main className="px-5 pt-4 pb-10 md:px-0 md:pt-8">
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
            priority
            sizes="(min-width: 768px) 1100px, 100vw"
            unoptimized={!canOptimize(heroImg)}
            className="object-cover"
          />
          <span className="absolute right-3 bottom-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white">{t("주변 사진 · 한국관광공사")}</span>
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
      {/* 한 문장 요약: 공식 단계·인원·기준 시각 (사람과 AI 검색이 바로 인용할 수 있게) */}
      {live && (
        <p className="mt-2 text-[13px] leading-relaxed text-gray-800">
          {t("{name}에는 지금 약 {range}이 있고, 서울시 공식 혼잡 단계는 ‘{level}’이에요 ({time} 기준, 서울시 실시간 도시데이터).", {
            name,
            range: people(live.min, live.max),
            level: t(live.level),
            time: live.time.slice(11, 16),
          })}
        </p>
      )}

      <div className="mt-4 lg:grid lg:grid-cols-2 lg:gap-8">
        <div>
          {live && level ? (
            <section className="rounded-3xl px-4 py-3.5" style={{ background: `${level.color}14` }}>
              <p className="text-xs font-medium text-gray-500">{t("지금 인구")}</p>
              <p className="text-2xl font-extrabold" style={{ color: level.color }}>
                {people(live.min, live.max)}
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                {t("서울시 단계")}: <b>{t(live.level)}</b>
              </p>
              {live.message && lang === "ko" && <p className="mt-2 text-xs leading-relaxed text-gray-600">{live.message}</p>}
              <p className="mt-2 text-[11px] text-gray-400">{t("{time} 기준", { time: live.time.slice(11) })}</p>
            </section>
          ) : (
            <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
              {t("지금은 서울시 데이터를 받지 못했어요. 잠시 후 다시 확인해 주세요.")}
            </p>
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
                <span className="text-xs font-bold" style={{ color: BUSY[extra.commerce.level] }}>
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
                      style={{ color: BUSY[c.level] ?? "#6b7280", background: `${BUSY[c.level] ?? "#6b7280"}1a` }}
                    >
                      {t(c.name)} · {t(c.level)}
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-[11px] text-gray-400">{t("카드 결제 건수로 본 업종별 붐빔 (서울시 실시간 도시데이터)")}</p>
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

          {live?.profile && (
            <section className="mt-4 rounded-3xl border border-gray-100 p-4">
              <h2 className="text-sm font-bold">{t("지금 이곳에 있는 사람들")}</h2>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full">
                <div className="bg-sky-400" style={{ width: `${live.profile.male}%` }} />
                <div className="bg-pink-400" style={{ width: `${live.profile.female}%` }} />
              </div>
              <p className="mt-1 flex justify-between text-xs text-gray-600">
                <span>
                  {t("남성")} {live.profile.male}%
                </span>
                <span>
                  {t("여성")} {live.profile.female}%
                </span>
              </p>
              <ul className="mt-4 flex h-24 items-end gap-1.5">
                {live.profile.ages.map((v, i) => (
                  <li key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-500">{Math.round(v)}%</span>
                    <span className="w-full rounded-t bg-indigo-400" style={{ height: `${Math.max(4, (v / maxAge) * 56)}px` }} />
                    <span className="text-[10px] text-gray-500">{i === 0 ? "0-9" : i === 7 ? "70+" : `${i}0s`}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-600">
                {t("이 동네에 사는 사람 {r}% · 다른 곳에서 온 사람 {v}%", {
                  r: Math.round(live.profile.resident),
                  v: Math.round(100 - live.profile.resident),
                })}
              </p>
            </section>
          )}
          {(() => {
            const toilets = nearest(TOILETS, area, (x) => ({ lat: x[1], lng: x[2] }), 50, 0.8).length;
            const spots = nearest(GUIDE, area, (g) => (g.lat && g.lng ? { lat: g.lat, lng: g.lng } : undefined), 6, 1);
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
                            {GUIDE_KINDS.find((k) => k.id === g.kind)?.emoji} {guideText(g, lang).text.n}
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
          <CalmAlternatives lat={area.lat} lng={area.lng} score={live?.score} selfId={`seoul-${area.code}`} lang={lang} />
          <StayLinks ko={area.name} en={enName} lang={lang} t={t} at={area} className="mt-4" />
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
      <p className="mt-8 text-center text-[11px] text-gray-400">{t("서울시 실시간 도시데이터 (통신사 기지국 기반 추정 인구)")}</p>
    </main>
  );
}
