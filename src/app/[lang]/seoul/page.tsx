import type { Metadata } from "next";
import { InlineAd } from "@/components/AdUnit";
import { SeoulAreaList, type SeoulAreaRow } from "@/components/SeoulAreaList";
import { FeatureGrid } from "@/components/home/FeatureLayouts";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";
import { translateNames } from "@/lib/name-translate";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { getAllSeoulLive, SEOUL_GROUPS, seoulGroup } from "@/lib/seoul-live";
import { compactNumber } from "@/lib/format";
import { photoNear } from "@/lib/seoul-guide";

// 서울시 실시간 인구는 5분 단위 → 10분마다 다시 렌더링 (지역마다 10분 캐시라 서울시 호출도 10분에 한 번)
export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const t = getT((await params).lang);
  return pageMeta({
    lang: (await params).lang,
    path: "/seoul",
    title: t("서울 실시간 인구 {n}곳", { n: SEOUL_AREAS.length }),
    description: t("강남역·성수·홍대·한강공원 등 서울 주요 장소의 지금 인구와 혼잡도 (서울시 실시간 도시데이터)"),
  });
}

export default async function SeoulPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const live = await getAllSeoulLive();
  const names = Object.fromEntries(
    await translateNames(
      SEOUL_AREAS.map((a) => a.name),
      lang,
    ),
  );
  const rows: SeoulAreaRow[] = SEOUL_AREAS.map((a) => ({
    code: a.code,
    name: a.name,
    group: seoulGroup(a.name),
    lat: a.lat,
    lng: a.lng,
    score: live[a.code]?.score,
    min: live[a.code]?.min,
    max: live[a.code]?.max,
    img: photoNear(a, 0.8),
  }));
  const time = Object.values(live)[0]?.time;

  return (
    <main className="px-5 pt-6 pb-8 md:px-0 md:pt-10">
      <h1 className="text-2xl font-bold md:text-3xl">{t("서울 실시간 인구 {n}곳", { n: SEOUL_AREAS.length })}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {t("관광특구·고궁·상권·공원·역 주변에 지금 몇 명이 있는지 5분마다 바뀌는 서울시 데이터로 보여드려요")}
      </p>
      {/* 배치 다양화 (사용자 10/22): 지금 가장 한산한 서울 — 큰 카드 1 + 작은 카드 4 (역 주변은 빼고, 사진 있는 곳) */}
      <FeatureGrid
        title={t("지금 가장 한산한 서울")}
        sub={t("관광특구·고궁·공원 중 지금 덜 붐비는 곳")}
        className="mt-6"
        items={rows
          .filter((r) => r.score !== undefined && r.img && r.group !== "station")
          .sort((a, b) => a.score! - b.score!)
          // 근처 사진을 빌려 쓰는 지역이 있어 같은 사진이 겹치면 건너뛴다
          .filter((r, i, arr) => arr.findIndex((x) => x.img === r.img) === i)
          .slice(0, 5)
          .map((r) => ({
            id: r.code,
            href: `/seoul/${r.code}`,
            img: r.img,
            title: names[r.name] ?? r.name,
            sub: t(SEOUL_GROUPS.find((g) => g.id === r.group)?.label ?? ""),
            score: r.score,
            people: r.min !== undefined ? t("{min}~{max}명", { min: compactNumber(r.min, lang), max: compactNumber(r.max ?? r.min, lang) }) : undefined,
          }))}
      />
      <SeoulAreaList rows={rows} names={names} />
      <InlineAd className="mt-6" />
      <p className="mt-6 text-center text-[11px] text-gray-500">
        {t("서울시 실시간 도시데이터 (통신사 기지국 기반 추정 인구)")}
        {time && ` · ${t("{time} 기준", { time: time.slice(11) })}`}
      </p>
    </main>
  );
}
