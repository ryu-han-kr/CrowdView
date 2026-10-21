import type { Metadata } from "next";
import Image from "next/image";
import { canOptimize } from "@/lib/img";
import { StayLinks } from "@/components/StayLinks";
import { notFound } from "next/navigation";
import Link from "@/i18n/link";
import { FaqBlock } from "@/components/FaqBlock";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { compactNumber } from "@/lib/format";
import { levelOf, inkOf } from "@/lib/levels";
import { translateNames } from "@/lib/name-translate";
import { GUIDE, GUIDE_KINDS, TOILETS, TOILET_FLAG, areaNear, getGuidePlace, guideText, nearest } from "@/lib/seoul-guide";
import { getAllSeoulLive } from "@/lib/seoul-live";
import { jsonLd, pageMeta } from "@/lib/seo";
import { KstNote } from "@/components/LocalTime";
import { Glyph } from "@/components/Glyph";

// 가이드 글은 주 1회 바뀌고, 혼잡도는 10분마다 → 10분마다 다시 그림 (처음 열 때 만든다)
export const revalidate = 600;
export const dynamicParams = true;
// 빈 배열이면 상위 [lang]의 dynamicParams=false 때문에 모든 주소가 404였다 → 한 곳이라도 미리 만들고 나머지는 처음 열 때 만든다
export function generateStaticParams() {
  return GUIDE.slice(0, 1).map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang, id } = await params;
  const p = getGuidePlace(id);
  if (!p) return {};
  const t = getT(lang);
  const { text } = guideText(p, lang as Lang);
  return pageMeta({
    lang,
    path: `/guide/${id}`,
    title: t("{name} 정보·지금 혼잡도", { name: text.n }),
    description: [text.a, text.h, text.sub?.split("\n")[0]].filter(Boolean).join(" · ").slice(0, 155),
  });
}

export default async function GuidePlacePage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { id } = await params;
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const p = getGuidePlace(id);
  if (!p) notFound();
  const { text, lang: textLang } = guideText(p, lang);
  // 그 언어 글이 없어 한국어로 보일 때 이름만이라도 번역 (Papago 캐시) — 원래 이름은 아래 작은 글씨로
  const trName = textLang === "ko" && lang !== "ko" ? (await translateNames([text.n], lang)).get(text.n) : undefined;
  const kind = GUIDE_KINDS.find((k) => k.id === p.kind)!;
  const at = p.lat && p.lng ? { lat: p.lat, lng: p.lng } : undefined;
  const area = at && areaNear(at);
  const live = area ? (await getAllSeoulLive())[area.code] : undefined;
  const areaName = area ? ((await translateNames([area.name], lang)).get(area.name) ?? area.name) : undefined;
  const toilets = at ? nearest(TOILETS, at, (x) => ({ lat: x[1], lng: x[2] }), 3, 1) : [];
  const around = at
    ? nearest(
        GUIDE.filter((g) => g.id !== p.id),
        at,
        (g) => (g.lat && g.lng ? { lat: g.lat, lng: g.lng } : undefined),
        6,
        1,
      )
    : [];
  const people = (min: number, max: number) => t("{min}~{max}명", { min: compactNumber(min, lang), max: compactNumber(max, lang) });
  const rows: [string, string | undefined][] = [
    [t("주소"), text.a],
    [t("운영"), text.h],
    [t("휴무"), text.off],
    [t("대표 메뉴"), text.menu],
    [t("가는 길"), text.sub],
    [t("문의"), text.tel],
  ];

  return (
    <main className="px-5 pt-4 pb-10 md:px-0 md:pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": p.kind === "food" ? "Restaurant" : p.kind === "shopping" ? "Store" : "TouristAttraction",
            name: text.n,
            address: { "@type": "PostalAddress", streetAddress: text.a, addressLocality: "Seoul", addressCountry: "KR" },
            ...(at && { geo: { "@type": "GeoCoordinates", latitude: at.lat, longitude: at.lng } }),
            ...(text.tel && { telephone: text.tel }),
            ...(text.menu && { hasMenu: text.menu }),
            ...(text.url && { sameAs: text.url }),
            ...(p.imgL && { image: p.imgL }),
          }),
        }}
      />
      <Link href="/guide" className="text-sm text-gray-500">
        ← {t("서울 여행 가이드")}
      </Link>
      <p className="mt-3 text-xs font-medium text-gray-500">
        <Glyph e={kind.emoji} /> {t(kind.label)}
        {p.gu && ` · ${t(p.gu)}`}
      </p>
      <h1 className="mt-1 text-2xl font-bold md:text-3xl">{trName ?? text.n}</h1>
      {trName && <p className="mt-0.5 text-sm text-gray-500">{text.n}</p>}
      <KstNote className="mt-1" />
      {textLang !== lang && <p className="mt-1 text-xs text-gray-500">{t("이 장소는 선택한 언어 글이 없어 다른 언어로 보여드려요.")}</p>}
      {p.imgL && (
        <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-3xl bg-gray-100 md:aspect-[21/8]">
          <Image
            src={p.imgL}
            alt={text.n}
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 768px) 1100px, 100vw"
            unoptimized={!canOptimize(p.imgL)}
            className="object-cover"
          />
          <span className="absolute right-3 bottom-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white">{t("사진 한국관광공사")}</span>
        </div>
      )}

      <div className="mt-5 lg:grid lg:grid-cols-2 lg:gap-8">
        <div>
          {live && area && (
            <Link href={`/seoul/${area.code}`} className="block rounded-3xl px-4 py-3.5" style={{ background: `${levelOf(live.score).color}14` }}>
              <p className="text-xs font-medium text-gray-500">{t("이 동네 지금 ({area})", { area: areaName! })}</p>
              <p className="text-xl font-extrabold" style={{ color: inkOf(levelOf(live.score).color) }}>
                {t(live.level)} · {people(live.min, live.max)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                {t("서울시 실시간 도시데이터")} · {t("{time} 기준", { time: live.time.slice(11) })}
              </p>
            </Link>
          )}
          <dl className="mt-4 space-y-2.5 text-sm">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-16 shrink-0 text-gray-500">{k}</dt>
                  <dd className="min-w-0 whitespace-pre-line text-gray-700">{v}</dd>
                </div>
              ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {at && (
              <a
                href={`https://map.kakao.com/link/to/${encodeURIComponent(text.n)},${at.lat},${at.lng}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-indigo-600 px-3 py-1.5 text-white"
              >
                {t("길찾기")}
              </a>
            )}
            {text.url && (
              <a href={text.url} target="_blank" rel="noreferrer" className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">
                Visit Seoul ›
              </a>
            )}
            {text.web && (
              <a href={text.web} target="_blank" rel="noreferrer" className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">
                {t("홈페이지")} ›
              </a>
            )}
          </div>
          {at && !p.exact && (
            <p className="mt-2 text-[11px] text-gray-500">{t("위치는 가까운 지하철역({station}) 기준이에요.", { station: p.station ?? "" })}</p>
          )}
        </div>

        <div className="mt-8 space-y-8 lg:mt-0">
          {p.kind !== "food" && <StayLinks ko={guideText(p, "ko").text.n} en={guideText(p, "en").text.n} lang={lang} t={t} at={at} />}
          {toilets.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-lg font-bold">
                  <Glyph e="🚻" className="h-5 w-5 text-indigo-500" /> {t("가까운 화장실")}
                </h2>
                <Link href={`/near?tab=toilet&lat=${at!.lat}&lng=${at!.lng}&name=${encodeURIComponent(text.n)}`} className="text-sm text-gray-500">
                  {t("더 보기")} ›
                </Link>
              </div>
              <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-100 text-sm">
                {toilets.map(({ item: x, km }) => (
                  <li key={`${x[0]}${x[1]}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{x[0]}</span>
                      <span className="block text-xs text-gray-500">
                        {x[3] & TOILET_FLAG.open24 ? t("24시간") : x[4]}
                        {x[3] & TOILET_FLAG.accessible ? ` · ${t("장애인")}` : ""}
                        {x[3] & TOILET_FLAG.diaper ? ` · ${t("기저귀 교환대")}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold">{Math.round(km * 1000)}m</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {around.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">{t("근처 가볼 곳")}</h2>
              <ul className="mt-2 grid grid-cols-2 gap-2">
                {around.map(({ item: g, km }) => (
                  <li key={g.id}>
                    <Link href={`/guide/${g.id}`} className="block h-full rounded-2xl border border-gray-100 px-3 py-2.5">
                      <span className="block truncate text-sm font-semibold">
                        {GUIDE_KINDS.find((k) => k.id === g.kind)?.emoji} {guideText(g, lang).text.n}
                      </span>
                      <span className="block text-[11px] text-gray-500">{km.toFixed(1)}km</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <FaqBlock
        className="mt-8"
        title={t("자주 묻는 질문")}
        items={[
          ...(live && area
            ? [
                {
                  q: t("{name} 근처 지금 붐비나요?", { name: text.n }),
                  a: t("{time} 기준 근처 {area} 일대는 '{level}'이고 약 {range}이 있어요.", {
                    time: live.time.slice(11),
                    area: areaName!,
                    level: t(live.level),
                    range: people(live.min, live.max),
                  }),
                },
              ]
            : []),
          ...(text.h ? [{ q: t("{name} 운영 시간은?", { name: text.n }), a: `${text.h}${text.off ? ` (${t("휴무")}: ${text.off})` : ""}` }] : []),
          ...(text.sub ? [{ q: t("{name} 어떻게 가나요?", { name: text.n }), a: text.sub.split("\n")[0] }] : []),
        ]}
      />
      <p className="mt-8 text-center text-[11px] text-gray-500">
        {p.id.startsWith("kt-") ? t("정보: 한국관광공사") : t("정보: Visit Seoul (서울관광재단, 서울 열린데이터광장)")}
      </p>
    </main>
  );
}
