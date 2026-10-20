import type { Metadata } from "next";
import spotImages from "@/data/korea/spot-images.json";
import { notFound } from "next/navigation";
import { CalmAlternatives } from "@/components/CalmAlternatives";
import { LevelBadge } from "@/components/Level";
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
import { PhotoGallery } from "@/components/PhotoGallery";
import { DailyForecastChart } from "@/components/DailyForecastChart";
import { HourlyChart } from "@/components/HourlyChart";
import spotKto from "@/data/korea/spot-kto.json";
import { getConcentration } from "@/lib/crowd/signals";
import { kst } from "@/lib/time";

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
    <main className="px-5 pt-4 pb-10 md:px-0 md:pt-8">
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
      <Link href="/explore" className="text-sm text-gray-500">
        ← {t("지역 여행")}
      </Link>

      {/* 사진 여러 장을 옆으로 밀어 넘겨 본다 (관광공사 사진, 명소마다 5~12장) */}
      <PhotoGallery
        photos={photos}
        alt={name}
        credits={photos.map(() => t("사진 한국관광공사"))}
        sizes="(min-width: 768px) 960px, 100vw"
        className="mt-3 aspect-[4/3] rounded-3xl bg-gray-100 md:aspect-[21/8]"
      />

      <p className="mt-4 text-xs font-medium text-gray-500">
        {t(l.region)} · <Glyph e={kind.emoji} /> {t(kind.label)}
      </p>
      <h1 className="mt-1 text-2xl font-bold md:text-3xl">{name}</h1>
      {lang !== "ko" && <p className="mt-0.5 text-sm text-gray-500">{l.n.ko}</p>}
      <KstNote className="mt-1" />

      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {/* 그래프: 모든 명소에 같은 자리. 관광공사 30일 예측 → 가까운 측정 지점의 오늘 시간대별 (없으면 없다고 쓴다) */}
          <section className="mb-6">
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
          {nearHourly && (
            <section className="mb-6">
              <h2 className="text-lg font-bold">{t("오늘 시간대별")}</h2>
              <p className="mt-0.5 mb-3 text-sm text-gray-500">{t("가까운 측정 지점 {name} 기준", { name: live!.label })}</p>
              <HourlyChart points={nearHourly.points} highlightHour={Math.floor(kst().hour)} estimated={nearHourly.estimated} unit={nearHourly.unit} />
            </section>
          )}
          {info?.overview && (
            <section>
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


          <section className="mt-6">
            <h2 className="text-lg font-bold">{t("이용 정보")}</h2>
            <dl className="mt-2 card divide-y divide-gray-100 p-0">
              {rows
                .filter((r): r is [string, string] => !!r[1])
                .map(([k, v]) => (
                  <div key={k} className="flex gap-3 px-4 py-3 text-sm">
                    <dt className="w-20 shrink-0 font-semibold text-gray-500">{k}</dt>
                    <dd lang="ko" className="min-w-0 whitespace-pre-line text-gray-800">
                      {v}
                    </dd>
                  </div>
                ))}
              {info?.homepage && (
                <div className="flex gap-3 px-4 py-3 text-sm">
                  <dt className="w-20 shrink-0 font-semibold text-gray-500">{t("홈페이지")}</dt>
                  <dd className="min-w-0 truncate">
                    <a href={info.homepage} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                      {info.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-1.5 text-xs text-gray-400">{t("자료: 한국관광공사. 방문 전 공식 안내를 확인하세요.")}</p>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-indigo-100 bg-white p-4">
            <p className="text-sm font-bold">{t("지금 혼잡도")}</p>
            {live ? (
              <Link href={live.href} className="mt-2 flex items-center gap-3 rounded-2xl bg-indigo-50/60 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{live.label}</span>
                  <span className="block text-xs text-gray-500">{t("가까운 측정 지점 · 자세히 보기")}</span>
                </span>
                <LevelBadge score={live.score} closed={!live.open} />
              </Link>
            ) : (
              <p className="mt-2 text-sm text-gray-500">{t("이곳은 아직 실시간 혼잡도 자료가 없어요.")}</p>
            )}
          </section>
          {live?.open && (
            <CalmAlternatives lat={l.lat} lng={l.lng} score={live.score} selfId={place ? place.id : `seoul-${area!.code}`} lang={lang} />
          )}

          <a
            href={landmarkMapHref(l, lang)}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl border border-gray-200 bg-white py-3 text-center text-sm font-semibold"
          >
            <Glyph e="🗺️" /> {t("지도에서 보기")}
          </a>
          <StayLinks ko={l.n.ko} en={l.n.en} lang={lang} t={t} at={l} />

          {others.length > 0 && (
            <section className="rounded-3xl border border-gray-100 bg-white p-4">
              <p className="text-sm font-bold">{t("{region}의 다른 명소", { region: t(l.region) })}</p>
              <ul className="mt-2 space-y-1">
                {others.map((o) => (
                  <li key={o.id}>
                    <Link href={`/spot/${o.id}`} className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm hover:bg-gray-50">
                      <span className="truncate">{o.n[lang] ?? o.n.ko}</span>
                      <span className="shrink-0 text-xs text-gray-400">{t("{km}km", { km: distanceKm(o, l).toFixed(0) })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
