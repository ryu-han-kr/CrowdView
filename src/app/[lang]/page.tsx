import Link from "@/i18n/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getT as getMetaT } from "@/i18n/server";
import { jsonLd, SITE } from "@/lib/seo";
import { HomeList, type SearchData } from "@/components/HomeList";
import { CategoryIcons } from "@/components/home/CategoryIcons";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
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
import { LANDMARKS, REGIONS, dailyPick, inRegion } from "@/lib/korea";
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
import { photoNear } from "@/lib/seoul-guide";

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
  const [crowd, livePlaces, seoul, allFestivals] = await Promise.all([getAllCrowd(), getLivePlaces(), getAllSeoulLive(), getFestivals(30)]);
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
  const listPlaces = places.map((p) => ({ ...p, image: heroImage(p) }));
  // 고해상도 사진 (place-photos 의 n번째, 없으면 기존 대표 사진)
  const photoOf = (id: string, n = 0) => placePhotos(id)[n]?.src ?? places.find((x) => x.id === id)?.image;
  // 지금 한산한 명소 (사진 있는 우리 장소)
  const calmCards: PhotoCardItem[] = places
    .filter((p) => heroImage(p) && crowd[p.id].open && p.category !== "airport" && p.category !== "event")
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
  const slides = (ko ? [...crowdSlides, ...travelSlides, routeSlide, plusSlide] : [...travelSlides, routeSlide, ...crowdSlides, plusSlide]).filter(
    (s): s is HeroSlide => !!s,
  );

  // 홈 통합 검색 탭 자료 (사용자 10/22: 지역 여행 탭 대신 홈에서 명소·축제·서울 지역·관광지를 한 번에)
  const [allNames, areaNames] = await Promise.all([
    translateNames(
      allFestivals.flatMap((f) => [f.title, f.region]),
      lang,
    ),
    translateNames(
      SEOUL_AREAS.map((a) => a.name),
      lang,
    ),
  ]);
  const search: SearchData = {
    regions: REGIONS.map((r) => r.id).filter((id) => LANDMARKS.some((l) => l.region === id) || allFestivals.some((f) => inRegion(f.region, id))),
    landmarks: LANDMARKS.map((l) => {
      const c = lm(l);
      return { id: c.id, href: c.href, img: c.img, title: c.title, sub: c.sub, score: c.score, tag: c.tag, region: l.region, keys: [l.n.ko] };
    }),
    festivals: allFestivals.map((f) => {
      const c = festivalCard(f, t, today, allNames);
      return {
        id: c.id,
        href: c.href,
        img: c.img,
        emoji: "🎪",
        title: c.title,
        sub: c.sub,
        badge: c.badge,
        region: REGIONS.find((r) => inRegion(f.region, r.id))?.id,
        keys: [f.title, f.region],
      };
    }),
    seoul: SEOUL_AREAS.map((a) => ({
      id: `seoul-${a.code}`,
      href: `/seoul/${a.code}`,
      img: photoNear(a, 0.8),
      emoji: "📍",
      title: areaNames.get(a.name) ?? a.name,
      sub: t("서울 실시간"),
      score: seoul[a.code]?.score,
      region: "서울",
      keys: [a.name],
    })),
  };

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
      {calmCards.length > 5 && <PhotoRail title={t("여기도 한산해요")} items={calmCards.slice(5)} />}
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
  const trendItems: RankItem[] = (trend?.items ?? []).slice(0, 5).map((x) => {
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
      note:
        x.kind === "event"
          ? `AI · ${trendTr.get(x.reason) ?? x.reason}`
          : x.rising && x.rising >= 1.5
            ? t("검색량 {n}배 ↑", { n: x.rising.toFixed(1) })
            : t("요즘 많이 찾는 곳"),
      hot: x.kind === "event" || (x.rising ?? 0) >= 1.5,
    };
  });
  const trendList = trendItems.length ? (
    <RankList title={t("요즘 뜨는 곳 TOP 5")} subtitle={t("네이버 검색량과 AI 뉴스 검색으로 매일 아침 갱신")} items={trendItems} />
  ) : (
    busyList
  );
  // ── 모음 섹션 (사용자 레퍼런스 10/22, photo/qa-ref/round3)
  // 1) 테마파크·워터파크·스키장 세로 카드: 실측 먼저, 그다음 한산한 순
  const leisure = places
    .filter((p) => ["themepark", "waterpark", "ski"].includes(p.category) && crowd[p.id]?.open && heroImage(p))
    .sort((a, b) => Number(crowd[b.id].source !== "model") - Number(crowd[a.id].source !== "model") || crowd[a.id].score - crowd[b.id].score)
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
      href: localePath(lang, "/?cat=landmark#places"),
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
  // 3) 모음 배너: 지금 한산한 3곳 + 큰 배경 사진 (배경은 그 묶음에서 가장 유명한 곳의 두 번째 사진)
  const makeCollection = (id: string, title: string, badge: string, href: string, pool: typeof places): Collection => {
    const inR = pool.filter((p) => crowd[p.id] && heroImage(p) && p.category !== "airport");
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
      "/?q=" + encodeURIComponent(t(r)) + "#places",
      places.filter((p) => p.region.startsWith(r)),
    ),
  ).filter((c) => c.items.length >= 3);
  // 같은 양식, 다른 배경 (사용자 10/23): 테마마다 모음 배너
  const THEME_SETS: { id: string; title: string; cat: string; test: (p: (typeof places)[number]) => boolean }[] = [
    { id: t("놀이공원"), title: t("놀이공원 지금 한산한 곳 모음"), cat: "themepark", test: (p) => p.category === "themepark" && subOf(p.id) === "amusement" },
    { id: t("워터파크"), title: t("워터파크 지금 한산한 곳 모음"), cat: "waterpark", test: (p) => p.category === "waterpark" },
    { id: t("실내·아쿠아리움"), title: t("비 와도 좋은 실내 모음"), cat: "themepark", test: (p) => ["aquarium", "indoor-waterpark"].includes(subOf(p.id) ?? "") },
    { id: t("거리·명소"), title: t("걷기 좋은 거리·명소 모음"), cat: "street", test: (p) => p.category === "street" || p.category === "landmark" || p.category === "beach" },
    { id: t("스키장"), title: t("스키장 미리 보는 혼잡 모음"), cat: "ski", test: (p) => p.category === "ski" },
  ];
  const themeCollections: Collection[] = THEME_SETS.map((x) =>
    makeCollection(x.id, x.title, t("테마 모음"), `/?cat=${x.cat}#places`, places.filter(x.test)),
  ).filter((c) => c.items.length >= 3);
  const shortRail = (
    <ShortCardRail title={t("테마파크·워터파크 지금")} sub={t("실시간 대기와 예상 혼잡을 한눈에")} moreHref="/map" items={shortCards} />
  );
  const themeSection = <ThemeTiles title={t("오늘은 이런 곳 어때요?")} sub={t("주제를 고르면 바로 그 목록으로")} tiles={themeTiles} />;
  const collectionSection = <CollectionCarousel title={t("지역별 한산한 곳 모음")} sub={t("지역을 고르면 지금 덜 붐비는 곳 3곳")} collections={collections} />;
  const themeCollectionSection = (
    <CollectionCarousel title={t("테마별 한산한 곳 모음")} sub={t("테마를 고르면 지금 덜 붐비는 곳 3곳")} collections={themeCollections} />
  );

  // 상태 알약: 실시간 자료 기준 시각 (NOL '공지' 줄 자리)
  const seoulTime = Object.values(seoul)[0]?.time?.slice(11, 16);

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
      {/* 휴대폰 머리: 로고 + 검색 알약 (NOL 레퍼런스 10/21). 제목(h1)은 검색엔진·PC용으로 아래에 */}
      <header className="mb-3 md:mb-5">
        <div className="flex items-center gap-3 md:hidden">
          <Link href="/" className="shrink-0 text-xl font-extrabold tracking-tight">
            <span className="text-indigo-600">Crowd</span>View
          </Link>
          <a
            href="#places"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-full border-2 border-indigo-500 bg-white px-4 py-2.5 text-[15px] text-gray-500"
          >
            <span className="min-w-0 flex-1 truncate">{t("장소·지역 검색")}</span>
            <Glyph e="🔍" className="h-5 w-5 shrink-0 text-indigo-600" />
          </a>
          <LangSwitcher iconOnly />
        </div>
        <h1 className="sr-only md:not-sr-only md:text-2xl md:font-bold">{ko ? t("지금 어디가 한산할까?") : t("한산할 때 즐기는 한국 여행")}</h1>
        <p className="mt-0.5 hidden text-sm text-gray-500 md:block">
          {ko ? t("공항·놀이공원·명소·축제의 실시간 혼잡도와 AI 예측을 한눈에") : t("명소·축제 안내와 실시간 혼잡도를 한 곳에서")}
        </p>
      </header>

      <HeroCarousel slides={slides} />
      {newest !== null && (
        <Link
          href="/methodology"
          className="mt-3 flex items-center gap-2 rounded-2xl bg-indigo-50/70 px-3.5 py-2.5 text-xs text-gray-700 md:mt-4 md:text-sm"
        >
          <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">LIVE</span>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="min-w-0 truncate">
            {t("{age} 갱신", { age: fmtAge(newest, t) })}
            {seoulTime && ` · ${t("서울시 {time} 기준", { time: seoulTime })}`} · {t("공항·놀이공원·서울 121곳 실측")}
          </span>
          <span className="ml-auto shrink-0 text-gray-400">›</span>
        </Link>
      )}
      <CategoryIcons t={t} lang={lang} />
      <RecentRail />

      {ko ? (
        <HomeList places={listPlaces} crowd={crowd} search={search}>
          {calmRail}
          {shortRail}
          {trendList}
          {themeSection}
          {festivalRail}
          {collectionSection}
          {plusPromo}
          {themeCollectionSection}
          {landmarkRail}
        </HomeList>
      ) : (
        <>
          {landmarkRail}
          {themeSection}
          {festivalRail}
          {calmRail}
          {shortRail}
          {collectionSection}
          {themeCollectionSection}
          {trendList}
          {plusPromo}
          <HomeList places={listPlaces} crowd={crowd} search={search} />
        </>
      )}
    </main>
  );
}
