import type { Metadata } from "next";
import { SeoulAreaList, type SeoulAreaRow } from "@/components/SeoulAreaList";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";
import { translateNames } from "@/lib/name-translate";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { getAllSeoulLive, seoulGroup } from "@/lib/seoul-live";

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
  const names = Object.fromEntries(await translateNames(SEOUL_AREAS.map((a) => a.name), lang));
  const rows: SeoulAreaRow[] = SEOUL_AREAS.map((a) => ({
    code: a.code,
    name: a.name,
    group: seoulGroup(a.name),
    score: live[a.code]?.score,
    min: live[a.code]?.min,
    max: live[a.code]?.max,
  }));
  const time = Object.values(live)[0]?.time;

  return (
    <main className="px-5 pt-6 pb-8 md:px-0 md:pt-10">
      <h1 className="text-2xl font-bold md:text-3xl">{t("서울 실시간 인구 {n}곳", { n: SEOUL_AREAS.length })}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {t("관광특구·고궁·상권·공원·역 주변에 지금 몇 명이 있는지 5분마다 바뀌는 서울시 데이터로 보여드려요")}
      </p>
      <SeoulAreaList rows={rows} names={names} />
      <p className="mt-6 text-center text-[11px] text-gray-400">
        {t("서울시 실시간 도시데이터 (통신사 기지국 기반 추정 인구)")}
        {time && ` · ${t("{time} 기준", { time: time.slice(11) })}`}
      </p>
    </main>
  );
}
