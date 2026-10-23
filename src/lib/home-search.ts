// 홈 통합 검색 탭 자료 (명소·축제·서울 지역). 홈 HTML에 넣으면 120KB가 늘어(10/23 측정: 홈 HTML 590KB 중 검색 자료 120KB)
// 첫 화면이 느려져서, 검색하거나 탭을 고를 때 /api/home-search/{lang} 에서 받는다 (5분 CDN 캐시)
import type { SearchData } from "@/components/HomeList";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { getAllCrowd } from "./crowd/service";
import { getFestivals } from "./festivals";
import { LANDMARKS, REGIONS, inRegion } from "./korea";
import { festivalCard, landmarkCard } from "./korea-cards";
import { translateNames } from "./name-translate";
import { getAllSeoulLive } from "./seoul-live";
import { SEOUL_AREAS } from "./seoul-areas";
import { areaPhoto } from "./seoul-guide";
import { kst } from "./time";

export async function homeSearch(lang: Lang): Promise<SearchData> {
  const t = getT(lang);
  const today = kst().date;
  const [crowd, seoul, allFestivals] = await Promise.all([getAllCrowd(), getAllSeoulLive(), getFestivals(30)]);
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
  return {
    regions: REGIONS.map((r) => r.id).filter((id) => LANDMARKS.some((l) => l.region === id) || allFestivals.some((f) => inRegion(f.region, id))),
    landmarks: LANDMARKS.map((l) => {
      const c = landmarkCard(l, lang, t, crowd, seoul);
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
      img: areaPhoto(a),
      emoji: "📍",
      title: areaNames.get(a.name) ?? a.name,
      sub: t("서울 실시간"),
      score: seoul[a.code]?.score,
      region: "서울",
      keys: [a.name],
    })),
  };
}
