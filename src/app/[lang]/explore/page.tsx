import type { Metadata } from "next";
import { ExploreView, type ExploreRegion } from "@/components/ExploreView";
import type { SpotRow } from "@/components/MoreSpots";
import spots from "@/data/korea/spots.json";
import { InlineAd } from "@/components/AdUnit";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { getAllCrowd } from "@/lib/crowd/service";
import { getFestivals, isLongRunning } from "@/lib/festivals";
import { LANDMARKS, LANDMARK_KINDS, REGIONS, inRegion } from "@/lib/korea";
import { festivalCard, landmarkCard } from "@/lib/korea-cards";
import { translateNames } from "@/lib/name-translate";
import { pageMeta } from "@/lib/seo";
import { getAllSeoulLive } from "@/lib/seoul-live";
import { kst } from "@/lib/time";

// 혼잡도는 10분마다, 축제는 6시간마다 바뀐다
export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getT(lang);
  return pageMeta({
    lang,
    path: "/explore",
    title: t("지역별 여행 · 대표 명소와 축제"),
    description: t("서울·부산·제주·경주 등 지역별 대표 명소와 다가오는 축제, 지금 혼잡도를 한 번에"),
  });
}

export default async function ExplorePage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const today = kst().date;
  const [crowd, seoul, festivals] = await Promise.all([getAllCrowd(), getAllSeoulLive(), getFestivals(60)]);
  const shown = festivals.filter((f) => !isLongRunning(f));
  const names = await translateNames(shown.flatMap((f) => [f.title, f.region]), lang);

  const regions: ExploreRegion[] = REGIONS.map((r) => ({
    id: r.id,
    landmarks: LANDMARKS.filter((l) => l.region === r.id).map((l) => ({ ...landmarkCard(l, lang, t, crowd, seoul), kind: l.kind })),
    festivals: shown.filter((f) => inRegion(f.region, r.id)).slice(0, 20).map((f) => festivalCard(f, t, today, names)),
  })).filter((r) => r.landmarks.length || r.festivals.length);

  return (
    <main className="px-5 pt-6 pb-8 md:px-0 md:pt-10">
      <h1 className="text-2xl font-bold md:text-3xl">{t("지역 여행")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("지역별 대표 명소와 축제, 그리고 지금 혼잡도. 혼잡도는 근처 실시간 데이터가 있는 곳만 보여요")}</p>
      <ExploreView
        regions={regions}
        kinds={LANDMARK_KINDS}
        initialSpots={(spots as SpotRow[]).filter((s) => s[2] === regions[0]?.id)}
        spotCounts={Object.fromEntries(REGIONS.map((r) => [r.id, (spots as SpotRow[]).filter((s) => s[2] === r.id).length]))}
      />
      <InlineAd className="mt-8" />
      <p className="mt-6 text-center text-[11px] text-gray-400">{t("사진·위치: 한국관광공사 TourAPI · 축제: 한국관광공사·서울시 · 혼잡도: 서울시 실시간 도시데이터·CrowdView 예측")}</p>
    </main>
  );
}
