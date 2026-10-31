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
import { areaPhoto } from "@/lib/seoul-guide";
import { PageHeader } from "@/components/PageHeader";

// 서울시 실시간 인구는 5분 단위 → 5분마다 다시 렌더링 (11/1: 낮엔 지역 캐시도 5분, 밤엔 10분이라 그대로 보임)
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const t = getT((await params).lang);
  return pageMeta({
    lang: (await params).lang,
    path: "/seoul",
    title: t("서울 실시간 장소 {n}곳", { n: SEOUL_AREAS.length }),
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
    img: areaPhoto(a),
  }));
  const time = Object.values(live)[0]?.time;

  return (
    <main className="px-5 pt-6 pb-8 md:px-0 md:pt-10">
      <PageHeader title={t("서울 실시간 장소 {n}곳", { n: SEOUL_AREAS.length })} name="otter">
        <p className="mt-1 text-gray-500">
          {t("서울 곳곳의 지금 인원, 5분마다 갱신")}
        </p>
      </PageHeader>
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
      {/* 11/1 지인 QA: 검색창이 위 사진 칸에 딱 붙어 갑자기 나왔다 → 위 '지금 가장 한산한 서울'처럼 제목으로 구역을 나눈다 */}
      <section className="mt-10">
        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">{t("원하는 장소 검색")}</h2>
        <p className="mt-0.5 text-[13px] font-medium text-gray-600 md:text-sm">{t("이름·종류로 찾고 지금 혼잡도로 정렬")}</p>
        <div className="mt-3">
          <SeoulAreaList rows={rows} names={names} />
        </div>
      </section>
      <InlineAd className="mt-6" />
      <p className="mt-6 text-center text-[11px] text-gray-500">
        {t("서울시 실시간 도시데이터 (통신사 기지국 기반 추정 인구)")}
        {time && ` · ${t("{time} 기준", { time: time.slice(11) })}`}
      </p>
    </main>
  );
}
