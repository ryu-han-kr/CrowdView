import Link from "@/i18n/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getT as getMetaT } from "@/i18n/server";
import { jsonLd, SITE } from "@/lib/seo";
import { HomeList } from "@/components/HomeList";
import { CategoryIcons } from "@/components/home/CategoryIcons";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { PhotoRail, type PhotoCardItem } from "@/components/home/PhotoRail";
import { PlusPromo } from "@/components/home/PlusPromo";
import { PLUS } from "@/lib/business";
import { getAllCrowd } from "@/lib/crowd/service";
import { festivalHref, getFestivalCrowd, getFestivals, isLongRunning } from "@/lib/festivals";
import { LANDMARKS, REGIONS, dailyPick } from "@/lib/korea";
import { festivalCard, landmarkCard } from "@/lib/korea-cards";
import { translateNames } from "@/lib/name-translate";
import { getLivePlaces } from "@/lib/place-info";
import { placeHref } from "@/lib/places";
import { getAllSeoulLive } from "@/lib/seoul-live";
import { addDays, daysUntil, kst } from "@/lib/time";
import { LangSwitcher } from "@/components/LangSwitcher";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { fmtAge, trRegion } from "@/i18n/patterns";
import { SEOUL_AREAS } from "@/lib/seoul-areas";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getMetaT(lang);
  return pageMeta({
    lang,
    path: "/",
    title: t("지금 어디가 한산할까? 실시간 혼잡도"),
    description: t("인천공항 출국장 대기시간, 에버랜드·롯데월드 놀이기구 대기, 서울 주요 장소 실시간 인구, 전국 축제 혼잡 예측을 한눈에"),
  });
}

/**
 * 홈: 큰 포토 배너 → 아이콘 메뉴 → (언어에 따라 순서가 다름) → 전체 장소 혼잡도.
 * 한국어(국내 접속)는 혼잡도를 먼저, 외국어(해외 접속은 자동으로 그 나라 언어)는 여행 안내를 먼저 보여준다
 */
export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const today = kst().date;
  const [crowd, places, seoul, allFestivals] = await Promise.all([getAllCrowd(), getLivePlaces(), getAllSeoulLive(), getFestivals(30)]);
  const live = Object.values(crowd).filter((c) => c.source !== "model");
  const newest = live.length ? Math.min(...live.map((c) => c.ageMinutes)) : null;


  // 축제: 2주 안에 열리는(진행 중 포함) 사진 있는 축제 → 작년 방문객으로 본 붐빔 비율이 큰 순 TOP 5
  const soon = allFestivals.filter((f) => !isLongRunning(f) && f.image && f.start <= addDays(today, 14)).slice(0, 12);
  const ratios = new Map(await Promise.all(soon.map(async (f) => [f.id, (await getFestivalCrowd(f).catch(() => undefined))?.ratio ?? 0] as const)));
  const topFestivals = [...soon].sort((a, b) => (ratios.get(b.id) ?? 0) - (ratios.get(a.id) ?? 0)).slice(0, 5);
  const names = await translateNames([...soon, ...allFestivals.slice(0, 4)].flatMap((f) => [f.title, f.region]), lang);
  const festivalCards = topFestivals.map((f) => festivalCard(f, t, today, names, ratios.get(f.id)));

  // 랜드마크: 오늘의 추천 + 지역별 칩
  const lm = (l: (typeof LANDMARKS)[number]) => landmarkCard(l, lang, t, crowd, seoul);
  const landmarkChips = [
    { id: "pick", label: t("오늘의 추천"), items: dailyPick(LANDMARKS, today, 10).map(lm) },
    ...REGIONS.map((r) => ({ id: r.id, label: t(r.id), items: LANDMARKS.filter((l) => l.region === r.id).map(lm) })).filter((c) => c.items.length >= 2),
  ];

  // 지금 한산한 명소 (사진 있는 우리 장소)
  const calmCards: PhotoCardItem[] = places
    .filter((p) => p.image && crowd[p.id].open && p.category !== "airport" && p.category !== "event")
    .sort((a, b) => crowd[a.id].score - crowd[b.id].score)
    .slice(0, 10)
    .map((p) => ({ id: p.id, href: placeHref(p), img: p.image, title: t(p.name), sub: t(p.region), score: crowd[p.id].score }));

  // 큰 배너: 진행 중 축제 · 오늘의 여행지 · Plus · 공항 · 서울 실시간 · 코스 추천
  const [pick1, pick2] = dailyPick(LANDMARKS, `${today}-hero`, 2);
  const hotFestival = topFestivals.find((f) => f.start <= today) ?? topFestivals[0];
  const travelSlides: HeroSlide[] = ([
    pick1 && {
      id: "pick",
      href: `/explore?region=${encodeURIComponent(pick1.region)}`,
      img: pick1.img,
      tag: t("오늘의 여행지"),
      title: pick1.n[lang] ?? pick1.n.ko,
      sub: t("{region}의 명소·축제와 지금 혼잡도를 한 번에", { region: t(pick1.region) }),
    },
    hotFestival && {
      id: "festival",
      href: festivalHref(hotFestival),
      img: hotFestival.image!,
      tag: hotFestival.start <= today ? t("진행 중 축제") : `D-${daysUntil(hotFestival.start)}`,
      title: names.get(hotFestival.title) ?? hotFestival.title,
      sub: `${hotFestival.start.replaceAll("-", ".")} ~ ${hotFestival.end.slice(5).replace("-", ".")} · ${names.get(hotFestival.region) ?? trRegion(hotFestival.region, t)}`,
    },
  ] as (HeroSlide | undefined)[]).filter((s): s is HeroSlide => !!s);
  const crowdSlides: HeroSlide[] = [
    { id: "airport", href: "/airport", img: "/places/icn-t1.jpg", tag: t("실시간"), title: t("인천공항 출국장, 지금 몇 분 기다릴까?"), sub: t("출국장별 대기 인원과 시간대별 예측") },
    {
      id: "seoul",
      href: "/seoul",
      img: "/places/gyeongbokgung.jpg",
      tag: t("실시간"),
      title: t("서울 실시간 인구 {n}곳", { n: SEOUL_AREAS.length }),
      sub: t("강남역·성수·홍대·한강공원… 지금 몇 명이 있을까?"),
    },
  ];
  const plusSlide: HeroSlide | undefined = pick2 && {
    id: "plus",
    href: "/pricing",
    img: pick2.img,
    tag: "Plus",
    title: t("붐비기 전에 알려 드려요"),
    sub: t("광고 제거 · 혼잡 알림 · 맞춤 코스 추천 — 월 {n}원", { n: PLUS.priceKrw.toLocaleString() }),
  };
  const routeSlide: HeroSlide = { id: "route", href: "/route", img: "/places/namsan.jpg", tag: t("추천 코스"), title: t("붐비는 시간을 피해 도는 코스"), sub: t("지하철 이동시간과 식사 시간까지 맞춰 드려요") };
  const ko = lang === "ko";
  const slides = (ko ? [...crowdSlides, ...travelSlides, routeSlide, plusSlide] : [...travelSlides, routeSlide, ...crowdSlides, plusSlide]).filter(
    (s): s is HeroSlide => !!s,
  );

  const festivalRail = (
    <PhotoRail title={t("지금 뜨는 축제 TOP 5")} subtitle={t("작년 같은 기간 방문객으로 본 예상 붐빔 순")} moreHref="/events" items={festivalCards} ranked />
  );
  const landmarkRail = (
    <PhotoRail title={t("지역별 대표 명소")} subtitle={t("사진을 누르면 지금 혼잡도와 길찾기")} moreHref="/explore" items={[]} chips={landmarkChips} />
  );
  const calmRail = <PhotoRail title={t("지금 한산한 명소")} subtitle={t("실시간·예측 혼잡도 기준")} moreHref="/map" items={calmCards} />;
  const plusPromo = <PlusPromo t={t} price={PLUS.priceKrw.toLocaleString()} />;

  return (
    <main className="px-5 pt-5 pb-4 md:px-0 md:pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "WebSite", name: "CrowdView", url: SITE, inLanguage: lang },
              { "@type": "Organization", name: "CrowdView", url: SITE, logo: `${SITE}/icon.png` },
            ],
          }),
        }}
      />
      <header className="mb-4 flex items-end justify-between gap-3 md:mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold tracking-wide text-indigo-500 md:hidden">CrowdView</p>
          </div>
          <h1 className="mt-0.5 text-xl font-bold md:text-2xl">{ko ? t("지금 어디가 한산할까?") : t("한산할 때 즐기는 한국 여행")}</h1>
          <p className="mt-0.5 hidden text-sm text-gray-500 md:block">
            {ko ? t("공항·놀이공원·명소·축제의 실시간 혼잡도와 AI 예측을 한눈에") : t("명소·축제 안내와 실시간 혼잡도를 한 곳에서")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="md:hidden">
            <LangSwitcher compact />
          </div>
          {newest !== null && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="relative flex h-2 w-2">
                <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {t("{age} 갱신", { age: fmtAge(newest, t) })}
            </span>
          )}
        </div>
      </header>

      <HeroCarousel slides={slides} />
      <CategoryIcons t={t} lang={lang} />

      {ko ? (
        <HomeList places={places} crowd={crowd}>
          {calmRail}
          {festivalRail}
          {plusPromo}
          {landmarkRail}
        </HomeList>
      ) : (
        <>
          {landmarkRail}
          {festivalRail}
          {calmRail}
          {plusPromo}
          <HomeList places={places} crowd={crowd} />
        </>
      )}
    </main>
  );
}
