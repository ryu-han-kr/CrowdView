import type { Metadata } from "next";
import { ExploreView, type ExploreRegion } from "@/components/ExploreView";
import type { SpotRow } from "@/components/MoreSpots";
import spots from "@/data/korea/spots.json";
import { InlineAd } from "@/components/AdUnit";
import { PageHeader } from "@/components/PageHeader";
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
  const initialSpots = (spots as SpotRow[]).filter((s) => s[2] === REGIONS[0]?.id);
  const [names, spotNames] = await Promise.all([
    translateNames(shown.flatMap((f) => [f.title, f.region]), lang),
    // 서버가 미리 그리는 첫 지역 명소 이름도 외국어로 (자체 QA 10/22)
    translateNames(initialSpots.map((s) => s[3]), lang),
  ]);

  const regions: ExploreRegion[] = REGIONS.map((r) => ({
    id: r.id,
    landmarks: LANDMARKS.filter((l) => l.region === r.id).map((l) => ({ ...landmarkCard(l, lang, t, crowd, seoul), kind: l.kind })),
    festivals: shown.filter((f) => inRegion(f.region, r.id)).slice(0, 20).map((f) => festivalCard(f, t, today, names)),
  })).filter((r) => r.landmarks.length || r.festivals.length);

  return (
    <main className="px-5 pt-6 pb-8 md:px-0 md:pt-10">
      {/* 11/1 UX 점검: 다른 탭 화면과 같은 머리(PageHeader — 위 여백·막대·크기)로, 설명은 한 줄로 줄임 */}
      <PageHeader title={t("지역 여행")} className="mb-1">
        <p className="mt-1 text-gray-500">{t("지역별 대표 명소·축제와 지금 혼잡도")}</p>
      </PageHeader>
      {/* 11/1 UX 점검: 페이지는 캐시(ISR)라 서버는 첫 지역(서울)을 그린다 → ?region=부산 으로 오면 화면이 뜨자마자 서울 명소가 보였다가 부산으로 바뀌었다.
          고른 지역이 그려질 때까지 본문을 숨긴다 (globals.css data-explore-wait, ExploreView가 지운다) */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var r=new URLSearchParams(location.search).get("region");if(r&&r!==${JSON.stringify(regions[0]?.id ?? "")}&&${JSON.stringify(regions.map((r) => r.id))}.indexOf(r)>=0)document.documentElement.setAttribute("data-explore-wait","")}catch(e){}`,
        }}
      />
      <ExploreView
        regions={regions}
        kinds={LANDMARK_KINDS}
        initialSpots={(regions[0]?.id === REGIONS[0]?.id ? initialSpots : (spots as SpotRow[]).filter((s) => s[2] === regions[0]?.id)).map(
          (s) => [s[0], s[1], s[2], spotNames.get(s[3]) ?? s[3], s[4], s[5], s[6], s[7]] as SpotRow,
        )}
        spotCounts={Object.fromEntries(REGIONS.map((r) => [r.id, (spots as SpotRow[]).filter((s) => s[2] === r.id).length]))}
      />
      <InlineAd className="mt-8" />
      <p className="mt-6 text-center text-[11px] text-gray-500">{t("사진·위치: 한국관광공사 TourAPI · 축제: 한국관광공사·서울시 · 혼잡도: 서울시 실시간 도시데이터·CrowdView 예측")}</p>
    </main>
  );
}
