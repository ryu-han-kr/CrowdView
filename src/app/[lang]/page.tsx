import Link from "@/i18n/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getT as getMetaT } from "@/i18n/server";
import { jsonLd, SITE } from "@/lib/seo";
import { HomeList, type HomePlace } from "@/components/HomeList";
import { homeCrowd } from "@/lib/home-crowd";
import { CategoryIcons } from "@/components/home/CategoryIcons";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { SeasonBackdrop, SproutStrip } from "@/components/home/SeasonBackdrop";
import { SeasonScene } from "@/components/home/SeasonScene";
import { pickSeasonFx, sceneOf } from "@/lib/season-fx";
import { HolidayRibbon } from "@/components/home/HolidayRibbon";
import { krDayOn } from "@/lib/kr-days";
import { seasonOf, seasonSort, seasonWeight } from "@/lib/season-order";
import { getNowWeather } from "@/lib/crowd/signals";
import { PhotoRail, type PhotoCardItem } from "@/components/home/PhotoRail";
import { PlusPromo } from "@/components/home/PlusPromo";
import { RecentRail } from "@/components/home/RecentRail";
import { RankList, type RankItem } from "@/components/home/RankList";
import { headcountInfo } from "@/lib/format";
import { placeTag } from "@/lib/category-style";
import { heroImage, placePhotos } from "@/lib/place-photos";
import { FeatureGrid } from "@/components/home/FeatureLayouts";
import { CollectionCarousel, ShortCardRail, ThemeTiles, type Collection, type ShortCard, type ThemeTile } from "@/components/home/HomeCollections";
import { levelOf } from "@/lib/levels";
import { CATEGORY_LABEL } from "@/lib/types";
import { subOf } from "@/lib/subcategory";
import { Glyph } from "@/components/Glyph";
import { PLUS } from "@/lib/business";
import { getAllCrowd } from "@/lib/crowd/service";
import { festivalHref, getFestivalCrowd, getFestivals, isLongRunning } from "@/lib/festivals";
import { LANDMARKS, REGIONS, dailyPick } from "@/lib/korea";
import { festivalCard, landmarkCard } from "@/lib/korea-cards";
import { translateNames } from "@/lib/name-translate";
import { getTrending } from "@/lib/trending";
import { getLivePlaces, isUpcomingEvent } from "@/lib/place-info";
import { placeHref } from "@/lib/places";
import { getAllSeoulLive } from "@/lib/seoul-live";
import { addDays, dateRange, daysUntil, kst } from "@/lib/time";
import { LangSwitcher } from "@/components/LangSwitcher";
import { localePath, type Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { fmtAge, trRegion } from "@/i18n/patterns";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { HomeGreeting } from "@/components/home/HomeGreeting";
import { InlineAd } from "@/components/AdUnit";
import { HomeSearchInput } from "@/components/home/HomeSearchInput";
import { LiveBadge } from "@/components/LiveBadge";
import { PageHeader } from "@/components/PageHeader";

// ISR: CDN이 5분 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
// (60초였을 때 ISR 쓰기 5일에 13만 건. 데이터는 10분마다 갱신되니 5분이면 충분)
export const revalidate = 300;

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
  const [crowd, livePlaces, seoul, allFestivals, nowWeather] = await Promise.all([
    getAllCrowd(),
    getLivePlaces(),
    getAllSeoulLive(),
    getFestivals(30),
    // 홈 배경 날씨 효과: 서울시청 격자의 이번 시각 예보 (경수님 10/28)
    getNowWeather({ lat: 37.5665, lng: 126.978 }),
  ]);
  // 기념일이면 그날 효과(크리스마스 눈·명절 꽃가루·한가위 달)가 계절·날씨 효과보다 먼저
  const krDay = krDayOn(today);
  // 계절 순서 (경수님 10/28): 아이콘·칩·테마 타일·놀이 카드·배너
  const season = seasonOf(today);
  const seasonFx = krDay?.fx ?? pickSeasonFx(Number(today.slice(5, 7)), nowWeather);
  // 끝난 행사 장소는 홈에서 뺀다 (자체 QA 10/22: 10/10에 끝난 서울세계불꽃축제가 여의도 실시간 값으로 '원활'로 나와 한산한 곳 맨 앞에)
  const places = livePlaces.filter((p) => p.category !== "event" || isUpcomingEvent(p, today));
  const live = Object.values(crowd).filter((c) => c.source !== "model");
  const newest = live.length ? Math.min(...live.map((c) => c.ageMinutes)) : null;

  // 축제: 2주 안에 열리는(진행 중 포함) 사진 있는 축제 → 작년 방문객으로 본 붐빔 비율이 큰 순 TOP 5
  const soon = allFestivals.filter((f) => !isLongRunning(f) && f.image && f.start <= addDays(today, 14)).slice(0, 12);
  const ratios = new Map(await Promise.all(soon.map(async (f) => [f.id, (await getFestivalCrowd(f).catch(() => undefined))?.ratio ?? 0] as const)));
  const topFestivals = [...soon].sort((a, b) => (ratios.get(b.id) ?? 0) - (ratios.get(a.id) ?? 0)).slice(0, 5);
  const names = await translateNames(
    [...soon, ...allFestivals.slice(0, 4)].flatMap((f) => [f.title, f.region]),
    lang,
  );
  const festivalCards = topFestivals.map((f) => festivalCard(f, t, today, names, ratios.get(f.id)));

  // 랜드마크: 오늘의 추천 + 지역별 칩
  const lm = (l: (typeof LANDMARKS)[number]) => landmarkCard(l, lang, t, crowd, seoul);
  const landmarkChips = [
    { id: "pick", label: t("오늘의 추천"), items: dailyPick(LANDMARKS, today, 10).map(lm) },
    ...REGIONS.map((r) => ({ id: r.id, label: t(r.id), items: LANDMARKS.filter((l) => l.region === r.id).map(lm) })).filter(
      (c) => c.items.length >= 2,
    ),
  ];

  // 목록·카드는 고해상도 대표 사진으로 (사용자 QA 10/22: 사진이 비슷해 구별이 어렵다). 서버에서 바꿔 넘겨 사진 목록 JSON이 브라우저로 가지 않게
  // 홈 목록(브라우저 컴포넌트)에는 쓰는 필드만 넘긴다 — 설명·기준·영업시간까지 보내면 HTML이 30KB 넘게 커진다 (10/26 성능)
  const listPlaces: HomePlace[] = places.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    region: p.region,
    lat: p.lat,
    lng: p.lng,
    emoji: p.emoji,
    tags: p.tags,
    image: heroImage(p),
    eventDate: p.eventDate,
    eventEndDate: p.eventEndDate,
  }));
  // 홈 목록은 지금 값만 쓴다 → 쓰는 칸만 골라 HTML을 줄인다 (사용자 10/26 성능, 10/31 라이트하우스: 갱신 시각·빈 배열까지 실렸다)
  const listCrowd = Object.fromEntries(Object.entries(crowd).map(([id, c]) => [id, homeCrowd(c)]));
  // 고해상도 사진 (place-photos 의 n번째, 없으면 기존 대표 사진)
  const photoOf = (id: string, n = 0) => placePhotos(id)[n]?.src ?? places.find((x) => x.id === id)?.image;
  // 지금 한산한 명소 (사진 있는 우리 장소)
  const calmCards: PhotoCardItem[] = places
    // 실내 액티비티(클라이밍장·오락실 등)는 '명소'가 아니라 뺀다 (10/27)
    .filter((p) => heroImage(p) && crowd[p.id].open && p.category !== "airport" && p.category !== "event" && p.category !== "indoor")
    .sort((a, b) => crowd[a.id].score - crowd[b.id].score)
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      href: placeHref(p),
      img: heroImage(p),
      title: t(p.name),
      sub: t(p.region),
      score: crowd[p.id].score,
      tag: placeTag(p, t),
      favId: p.id,
      people: headcountInfo(crowd[p.id], { t, lang })?.text,
    }));

  // 큰 배너: 진행 중 축제 · 오늘의 여행지 · Plus · 공항 · 서울 실시간 · 코스 추천
  const [pick1, pick2] = dailyPick(LANDMARKS, `${today}-hero`, 2);
  const hotFestival = topFestivals.find((f) => f.start <= today) ?? topFestivals[0];
  const travelSlides: HeroSlide[] = (
    [
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
        sub: `${dateRange(hotFestival.start, hotFestival.end)} · ${names.get(hotFestival.region) ?? trRegion(hotFestival.region, t)}`,
      },
    ] as (HeroSlide | undefined)[]
  ).filter((s): s is HeroSlide => !!s);
  const crowdSlides: HeroSlide[] = [
    {
      id: "airport",
      href: "/airport",
      // 출국장 줄 사진 대신 노을 진 터미널 (관광공사 관광사진 갤러리, UI QA 10차)
      img: "https://tong.visitkorea.or.kr/cms2/website/14/2541314.jpg",
      live: true,
      tag: t("실시간"),
      title: t("인천공항 출국장, 지금 몇 분 기다릴까?"),
      sub: t("출국장별 대기 인원과 시간대별 예측"),
    },
    {
      id: "seoul",
      href: "/seoul",
      img: photoOf("gyeongbokgung", 1) ?? "/places/gyeongbokgung.jpg",
      live: true,
      tag: t("실시간"),
      title: t("서울 실시간 장소 {n}곳", { n: SEOUL_AREAS.length }),
      sub: t("강남역·성수·홍대·한강공원… 지금 몇 명이 있을까?"),
    },
  ];
  const plusSlide: HeroSlide | undefined = pick2 && {
    id: "plus",
    href: "/pricing",
    img: pick2.img,
    tag: "Plus",
    title: t("붐비기 전에 알려 드려요"),
    sub: t("광고 제거 · 혼잡 알림 · 맞춤 코스 추천 — 1개월 {n}원", { n: PLUS.priceKrw.toLocaleString() }),
  };
  const routeSlide: HeroSlide = {
    id: "route",
    href: "/route",
    img: photoOf("namsan") ?? "/places/namsan.jpg",
    tag: t("추천 코스"),
    title: t("붐비는 시간을 피해 도는 코스"),
    sub: t("지하철 이동시간과 식사 시간까지 맞춰 드려요"),
  };
  const ko = lang === "ko";

  const festivalRail = (
    <PhotoRail
      title={t("지금 뜨는 축제 TOP 5")}
      subtitle={t("작년 같은 기간 방문객으로 본 예상 붐빔 순")}
      moreHref="/events"
      items={festivalCards}
      ranked
    />
  );
  const landmarkRail = (
    <PhotoRail
      title={t("지역별 대표 명소")}
      subtitle={t("사진을 누르면 지금 혼잡도와 길찾기")}
      moreHref="/explore"
      items={[]}
      chips={landmarkChips}
    />
  );
  // 지금 보통 이하인 곳이 하나도 없으면 '한산한'이라고 부르지 않는다 (주말 오후 등)
  const anyCalm = calmCards.some((c) => (c.score ?? 100) < 60);
  // 큰 카드 1 + 작은 카드 4 (사용자 10/22: 배치 다양화). 나머지 한산한 곳은 아래 가로 줄로
  const calmRail = (
    <>
      <FeatureGrid
        title={anyCalm ? t("지금 한산한 명소") : t("그나마 덜 붐비는 곳")}
        sub={t("실시간·예측 혼잡도 기준")}
        moreHref="/map"
        items={calmCards.slice(0, 5)}
        className={ko ? "mt-6 md:mt-10" : undefined}
      />
    </>
  );
  const plusPromo = <PlusPromo t={t} price={PLUS.priceKrw.toLocaleString()} />;
  // 지금 붐비는 TOP 5: 실측 들어오는 운영 중 장소를 붐비는 순으로 (NOL '많이 찾은 즐길거리' 레퍼런스 — 큰 순위 숫자 + 오른쪽 사진)
  const busyItems: RankItem[] = places
    .filter((p) => crowd[p.id] && crowd[p.id].source !== "model" && crowd[p.id].open)
    .sort((a, b) => crowd[b.id].score - crowd[a.id].score)
    .slice(0, 5)
    .map((p) => {
      const c = crowd[p.id];
      const hc = headcountInfo(c, { t, lang });
      const vs =
        c.vsUsual === undefined
          ? undefined
          : Math.abs(c.vsUsual - 1) < 0.1
            ? t("평소 이 시간과 비슷해요")
            : t(c.vsUsual > 1 ? "평소 이 시간보다 {n}% 많아요" : "평소 이 시간보다 {n}% 적어요", { n: Math.round(Math.abs(c.vsUsual - 1) * 100) });
      return {
        id: p.id,
        href: placeHref(p),
        title: t(p.name),
        sub: c.avgWaitMin !== undefined ? t("놀이기구 평균 대기 {n}분", { n: c.avgWaitMin }) : hc?.text,
        note: vs ?? `${t(p.region)} · ${t("{age} 갱신", { age: fmtAge(c.ageMinutes, t) })}`,
        img: heroImage(p),
        emoji: p.emoji,
        score: c.score,
      };
    });
  const busyList = (
    <RankList
      title={t("지금 붐비는 TOP 5")}
      subtitle={t("실측 자료가 들어오는 곳 기준 · 피하고 싶다면 참고하세요")}
      moreHref="/map"
      moreLabel={t("지도에서 보기")}
      items={busyItems}
    />
  );
  // 요즘 뜨는 곳 (사용자 10/22: 붐비는 순위 대신 유명·화제인 곳, 매일 자동 갱신 — lib/trending). 아직 계산 전이면 붐비는 순위
  const trend = await getTrending();
  const trendTr = trend ? await translateNames(trend.items.flatMap((x) => [x.title, x.kind === "event" ? x.reason : undefined, x.region]), lang) : new Map<string, string>();
  // 경수님 QA #22 (10/27): TOP 5 → TOP 10. 자료(검색량·AI 뉴스·축제)는 매일 12곳 넘게 쌓인다
  const trendItems: RankItem[] = (trend?.items ?? []).slice(0, 10).map((x) => {
    const region = x.region ? (trendTr.get(x.region) ?? trRegion(x.region, t)) : undefined;
    // 뉴스 화제: 제목은 장소 이름, 기사 제목은 둘째 줄 (UI QA 9차: 잘린 기사 제목이 제목 자리에 '…"…'로 보였다)
    const newsPlace = x.id.startsWith("news-") ? places.find((p) => p.id === x.id.slice(5)) : undefined;
    if (newsPlace) {
      const headline = (trendTr.get(x.title) ?? x.title).replace(/(…|\.\.\.)+$/, "");
      return {
        id: x.id,
        href: x.href,
        title: t(newsPlace.name),
        img: x.img,
        emoji: "📰",
        sub: headline,
        note: [region, t("뉴스 화제")].filter(Boolean).join(" · "),
        hot: true,
      };
    }
    return {
      id: x.id,
      href: x.href,
      external: x.external,
      title: trendTr.get(x.title) ?? x.title,
      img: x.img,
      emoji: x.kind === "event" ? "🎉" : "📍",
      sub: [x.period, region].filter(Boolean).join(" · ") || undefined,
      // 11/1 지인 QA: 화제 이유가 잘려 못 읽고 앞의 'AI ·'는 뜻을 모르겠다 → 'AI ·' 빼고 두 줄까지 (검색량·빨간 글씨는 경수님 확인으로 그대로)
      note:
        x.kind === "event"
          ? (trendTr.get(x.reason) ?? x.reason)
          : x.rising && x.rising >= 1.5
            ? t("검색량 {n}배 ↑", { n: x.rising.toFixed(1) })
            : t("요즘 많이 찾는 곳"),
      hot: x.kind === "event" || (x.rising ?? 0) >= 1.5,
      wrap: x.kind === "event",
    };
  });
  const trendList = trendItems.length ? (
    <RankList title={t("요즘 뜨는 곳 TOP {n}", { n: trendItems.length })} subtitle={t("네이버 검색량과 AI 뉴스 검색으로 매일 아침 갱신")} items={trendItems} />
  ) : (
    busyList
  );
  // ── 모음 섹션 (사용자 레퍼런스 10/22, photo/qa-ref/round3)
  // 1) 테마파크·워터파크·스키장 세로 카드: 실측 먼저, 그다음 한산한 순
  const leisure = places
    .filter((p) => ["themepark", "waterpark", "ski"].includes(p.category) && crowd[p.id]?.open && heroImage(p))
    .sort(
      (a, b) =>
        seasonWeight(season, a.category) - seasonWeight(season, b.category) ||
        Number(crowd[b.id].source !== "model") - Number(crowd[a.id].source !== "model") ||
        crowd[a.id].score - crowd[b.id].score,
    )
    .slice(0, 10);
  const shortCards: ShortCard[] = leisure.map((p) => {
    const c = crowd[p.id];
    const lv = levelOf(c.score);
    const live = c.source !== "model";
    const hc = headcountInfo(c, { t, lang });
    return {
      id: p.id,
      href: placeHref(p),
      img: heroImage(p),
      badge: live ? "LIVE" : t("예측"),
      live,
      headline: c.avgWaitMin !== undefined ? t("평균 대기 {n}분", { n: c.avgWaitMin }) : placeTag(p, t).label,
      title: t(p.name),
      boxLine: t(p.region),
      boxValue: [t(lv.label), hc?.text].filter(Boolean).join(" · "),
      boxColor: lv.color,
    };
  });
  // 큰 배너 두 개 (경수님 10/27): PC는 왼쪽 '지금 혼잡'·오른쪽 '여행·소식'을 나란히, 각각 최대 6장. 같은 곳이 두 배너에 겹치지 않게.
  // 휴대폰은 한 배너에 둘을 번갈아 섞어 보여 준다
  const used = new Set<string>();
  const uniq = (list: (HeroSlide | undefined | false)[]) =>
    list
      // 한 번에 거르며 기록한다 (거르기를 두 번에 나누면 같은 목록 안의 중복은 못 거른다 — 10/27 롯데월드가 두 번 나왔다). 주소·제목 둘 다
      .filter((s): s is HeroSlide => {
        if (!s || !s.img || used.has(s.href) || used.has(s.title)) return false;
        used.add(s.href).add(s.title);
        return true;
      })
      .slice(0, 6);
  const calm1 = calmCards[0];
  const busy1 = busyItems[0];
  const trend1 = trendItems.find((x) => x.img && !x.external);
  const ride1 = shortCards.find((c) => c.live) ?? shortCards[0];
  const crowdBanner = uniq([
    ...crowdSlides,
    ride1 && { id: "ride", href: ride1.href, img: ride1.img!, live: ride1.live, tag: t("실시간 대기"), title: ride1.title, sub: `${ride1.headline} · ${ride1.boxValue}` },
    calm1 && { id: "calm", href: calm1.href, img: calm1.img!, tag: t("지금 한산한 명소"), title: t("{name}, 지금 한산해요", { name: calm1.title }), sub: calm1.sub },
    busy1 && { id: "busy", href: busy1.href, img: busy1.img!, live: true, tag: t("지금 붐비는 곳"), title: busy1.title, sub: busy1.sub },
    trend1 && { id: "trend", href: trend1.href, img: trend1.img!, tag: t("요즘 뜨는 곳 1위"), title: trend1.title, sub: trend1.sub },
  ]);
  const nextFestival = topFestivals.find((f) => f !== hotFestival && f.image);
  // 계절 배너: 스키 시즌엔 스키장, 여름엔 워터파크를 여행 배너 두 번째에 (경수님 10/28)
  const seasonSlide: HeroSlide | undefined =
    season === "ski"
      ? // 배너는 Link가 언어 접두사를 붙인다 → localePath를 또 쓰면 /en/en/… (11/1 UX 점검)
        { id: "season-ski", href: "/?cat=ski#places", img: photoOf("phoenix") ?? "", tag: t("시즌"), title: t("올겨울 스키장"), sub: t("개장 전에 미리 보는 혼잡 예측") }
      : season === "summer"
        ? { id: "season-water", href: "/?cat=waterpark#places", img: photoOf("caribbean-bay") ?? "", tag: t("시즌"), title: t("여름엔 워터파크"), sub: t("물놀이 가기 전 혼잡 미리 보기") }
        : undefined;
  const travelBanner = uniq([
    travelSlides[0],
    seasonSlide,
    ...travelSlides.slice(1),
    nextFestival && {
      id: "festival2",
      href: festivalHref(nextFestival),
      img: nextFestival.image!,
      tag: nextFestival.start <= today ? t("진행 중 축제") : t("다가오는 축제"),
      title: names.get(nextFestival.title) ?? nextFestival.title,
      sub: `${dateRange(nextFestival.start, nextFestival.end)} · ${names.get(nextFestival.region) ?? trRegion(nextFestival.region, t)}`,
    },
    routeSlide,
    plusSlide,
  ]);
  const [firstBanner, secondBanner] = ko ? [crowdBanner, travelBanner] : [travelBanner, crowdBanner];
  const mobileSlides = Array.from({ length: Math.max(firstBanner.length, secondBanner.length) }, (_, i) => [firstBanner[i], secondBanner[i]])
    .flat()
    .filter((s): s is HeroSlide => !!s);

  // 2) 테마 타일: 고른 주제로 바로 이동 (사진은 그 주제의 대표 장소)
  const countCalm = (f: (p: (typeof places)[number]) => boolean) => places.filter((p) => f(p) && crowd[p.id]?.open && crowd[p.id].score < 40).length;
  const themeTiles: ThemeTile[] = [
    {
      id: "aquarium",
      href: localePath(lang, "/?q=" + encodeURIComponent(t("아쿠아리움")) + "#places"),
      img: photoOf("aquaplanet-jeju"),
      badge: t("추천"),
      title: t("비 오는 날엔 아쿠아리움"),
      sub: t("실내라 날씨 걱정 없어요"),
    },
    {
      id: "family",
      href: localePath(lang, "/?cat=themepark#places"),
      img: photoOf("everland"),
      badge: t("가족"),
      title: t("아이와 함께 테마파크"),
      // 한산한 곳이 0곳이면 '0곳'이라 쓰지 않는다 (UI QA 9차)
      sub: ((n) => (n ? t("지금 한산한 테마파크 {n}곳", { n }) : t("놀이기구 대기 시간 한눈에")))(countCalm((p) => p.category === "themepark")),
    },
    {
      id: "palace",
      // 11/1 UX 점검: ?cat=landmark는 실시간 장소의 명소 2곳만 (칩도 없어 텅 빈 듯) → 명소 탭(전국 명소)으로
      href: localePath(lang, "/?tab=landmark#places"),
      img: photoOf("gyeongbokgung"),
      badge: t("추천"),
      title: t("고궁·명소 산책"),
      sub: t("경복궁부터 남산까지, 덜 붐빌 때 가기"),
    },
    {
      id: "ski",
      href: localePath(lang, "/?cat=ski#places"),
      img: photoOf("phoenix"),
      badge: t("시즌"),
      title: t("올겨울 스키장"),
      sub: t("개장 전에 미리 보는 혼잡 예측"),
    },
    {
      id: "festival",
      href: localePath(lang, "/events"),
      img: photoOf("seoul-fireworks"),
      badge: t("축제"),
      title: t("이번 주 축제"),
      sub: t("작년 방문객으로 본 예상 붐빔"),
    },
    {
      id: "seoul",
      href: localePath(lang, "/seoul"),
      // 골목 일상 사진 대신 북촌 한옥 지붕 (관광사진 갤러리, UI QA 10차)
      img: LANDMARKS.find((l) => l.id === "bukchon")?.img ?? photoOf("hongdae"),
      badge: t("실시간"),
      title: t("서울 실시간 {n}곳", { n: SEOUL_AREAS.length }),
      sub: t("강남역·성수·한강공원, 지금 몇 명?"),
    },
  ];
  // '지역별 한산한 곳 모음'·'지역별 대표 명소': 10/27 홈 2차에서 뺐다가 경수님 요청으로 되살림 (같은 날 저녁). PC는 모음 2개 나란히(QA #13)
  // 3) 모음 배너: 지금 한산한 3곳 + 큰 배경 사진 (배경은 그 묶음에서 가장 유명한 곳의 두 번째 사진)
  const makeCollection = (id: string, title: string, badge: string, href: string, pool: typeof places): Collection => {
    // 실내 액티비티(클라이밍장·오락실)는 명소 모음에서 뺀다 — 서울 모음이 클라이밍장 3곳으로만 찼다 (10/27)
    const inR = pool.filter((p) => crowd[p.id] && heroImage(p) && p.category !== "airport" && p.category !== "indoor");
    const top = [...inR].sort((a, b) => b.popularity - a.popularity)[0];
    const items = [...inR]
      .sort((a, b) => Number(crowd[b.id].open) - Number(crowd[a.id].open) || crowd[a.id].score - crowd[b.id].score)
      .slice(0, 3)
      .map((p) => {
        const c = crowd[p.id];
        const lv = levelOf(c.score);
        return {
          id: p.id,
          href: placeHref(p),
          img: heroImage(p),
          title: t(p.name),
          value: c.open ? [t(lv.label), headcountInfo(c, { t, lang })?.text].filter(Boolean).join(" · ") : t("운영 종료"),
          color: c.open ? lv.color : "#6b7280",
        };
      });
    return {
      id,
      title,
      badge,
      sub: t("지금 덜 붐비는 순 {n}곳", { n: items.length }),
      href,
      img: top ? (placePhotos(top.id)[1]?.src ?? heroImage(top)) : undefined,
      items,
    };
  };
  const REGION_SETS = ["서울", "경기", "부산", "제주", "강원"];
  const collections: Collection[] = REGION_SETS.map((r) =>
    makeCollection(
      t(r),
      t("{region} 지금 한산한 곳 모음", { region: t(r) }),
      t("지역 모음"),
      // 11/1 경수님: 홈 안 검색(/?q=)으로 보내면 같은 화면이 다시 그려지며 아래로 튀었다 → 그 지역 명소·축제 화면으로
      `/explore?region=${encodeURIComponent(r)}`,
      places.filter((p) => p.region.startsWith(r)),
    ),
  ).filter((c) => c.items.length >= 3);
  const collectionSection = <CollectionCarousel title={t("지역별 한산한 곳 모음")} sub={t("지역을 고르면 지금 덜 붐비는 곳 3곳")} collections={collections} />;
  const shortRail = (
    <ShortCardRail title={t("테마파크·워터파크 지금")} sub={t("실시간 대기와 예상 혼잡을 한눈에")} moreHref="/map" items={shortCards} />
  );
  const themeSection = (
    <ThemeTiles
      title={t("오늘은 이런 곳 어때요?")}
      sub={t("주제를 고르면 바로 그 목록으로")}
      tiles={seasonSort(themeTiles, (x) => (x.id === "palace" ? "landmark" : x.id), season)}
    />
  );

  // 상태 알약: 실시간 자료 기준 시각 (NOL '공지' 줄 자리)
  const seoulTime = Object.values(seoul)[0]?.time?.slice(11, 16);
  const seoulScores = Object.values(seoul).map((s) => s.score);

  return (
    <main className="relative isolate px-5 pt-5 pb-4 md:px-0 md:pt-10">
      <SeasonScene scene={sceneOf(seasonFx, Number(today.slice(5, 7)))} />
      <SeasonBackdrop fx={seasonFx} />
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
      {/* 휴대폰 머리: 로고 + 검색 알약 (NOL 레퍼런스 10/21). 제목(h1)은 검색엔진·PC용으로 아래에 */}
      <header className="mb-3 md:mb-5">
        <div className="flex items-center gap-3 md:hidden">
          <Link href="/" className="shrink-0 text-xl font-extrabold tracking-tight">
            <span className="text-indigo-600">Crowd</span>View
          </Link>
          <HomeSearchInput />
          <LangSwitcher iconOnly />
        </div>
        {/* 제목 h1은 하나만: 화면 읽기·검색용 숨은 제목, PC에 보이는 제목은 같은 글자를 그림으로 (총점검 10/30: h1이 둘이었다) */}
        <h1 className="sr-only">{ko ? t("지금 어디가 한산할까?") : t("한산할 때 즐기는 한국 여행")}</h1>
        {/* PC 제목: 다른 탭 화면과 같은 머리(색 막대·크기·위 여백 pt-10) — 경수님 10/27: 홈 제목만 거리가 달랐다 */}
        <PageHeader title={ko ? t("지금 어디가 한산할까?") : t("한산할 때 즐기는 한국 여행")} heading={false} className="hidden md:flex">
          <p className="mt-1 text-sm text-gray-500">
            {ko ? t("공항·놀이공원·명소·축제의 실시간 혼잡도와 AI 예측을 한눈에") : t("명소·축제 안내와 실시간 혼잡도를 한 곳에서")}
          </p>
        </PageHeader>
      </header>
      <SproutStrip fx={seasonFx} />
      <HolidayRibbon day={krDay} />

      <div className="md:hidden">
        <HeroCarousel slides={mobileSlides} />
      </div>
      {/* PC: 배너 두 개를 나란히, 서로 다른 내용 (휴대폰용 배너가 첫 사진을 받으므로 여기는 lazy) */}
      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <HeroCarousel slides={firstBanner} layout="single" eager={false} />
        <HeroCarousel slides={secondBanner} layout="single" eager={false} />
      </div>
      {seoulScores.length ? (
        <HomeGreeting
          scores={seoulScores}
          hour={kst().hour}
          t={t}
          live={
            <>
              <LiveBadge />
              <span className="min-w-0 truncate">
                {newest !== null && t("{age} 갱신", { age: fmtAge(newest, t) })}
                {seoulTime && `${newest !== null ? " · " : ""}${t("서울시 {time} 기준", { time: seoulTime })}`}
              </span>
            </>
          }
        />
      ) : (
        newest !== null && (
          <Link
            href="/methodology"
            className="mt-3 flex items-center gap-2 rounded-2xl bg-indigo-50/70 px-3.5 py-2.5 text-xs text-gray-700 md:mt-4 md:text-sm"
          >
            <LiveBadge />
            <span className="min-w-0 truncate">
              {t("{age} 갱신", { age: fmtAge(newest, t) })}
              {seoulTime && ` · ${t("서울시 {time} 기준", { time: seoulTime })}`} · {t("공항·놀이공원·서울 121곳 실측")}
            </span>
            <span className="ml-auto shrink-0 text-gray-400">›</span>
          </Link>
        )
      )}
      <CategoryIcons t={t} lang={lang} season={season} />

      {ko ? (
        <HomeList places={listPlaces} crowd={listCrowd} withSearch season={season}>
          {calmRail}
          {shortRail}
          {trendList}
          {themeSection}
          <InlineAd className="mt-8" />
          {festivalRail}
          {collectionSection}
          {plusPromo}
          {landmarkRail}
          {/* 최근 본 곳: 아이콘 바로 아래에선 몇 개만 있어 화면이 비어 보였다 → 맨 아래로 (경수님 10/27) */}
          <RecentRail />
        </HomeList>
      ) : (
        <>
          {landmarkRail}
          {themeSection}
          <InlineAd className="mt-8" />
          {festivalRail}
          {calmRail}
          {shortRail}
          {collectionSection}
          {trendList}
          {plusPromo}
          <RecentRail />
          <HomeList places={listPlaces} crowd={listCrowd} withSearch season={season} />
        </>
      )}
    </main>
  );
}
