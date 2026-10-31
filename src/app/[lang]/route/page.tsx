import type { Metadata } from "next";
import { RoutePlanner } from "@/components/RoutePlanner";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { translateNames } from "@/lib/name-translate";
import { START_HUBS } from "@/lib/route-data";
import { kakaoLocalOn } from "@/lib/kakao-local";
import { pageMeta } from "@/lib/seo";
import { KstNote } from "@/components/LocalTime";
import { PageHeader } from "@/components/PageHeader";
import { NearbyRail } from "@/components/NearbyRail";
import { InlineAd } from "@/components/AdUnit";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getT(lang);
  return pageMeta({
    lang,
    path: "/route",
    title: t("한산한 서울 코스 추천"),
    description: t("지금 위치에서 출발해 붐비는 시간을 피해 도는 서울 반나절·하루 코스를 실시간 인구로 짜 드려요"),
  });
}

// 카카오 장소 검색을 켜면 1시간 안에 애니·백화점·플래그십 관심사가 열린다
export const revalidate = 3600;

export default async function RoutePage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const names = Object.fromEntries(
    await translateNames(
      START_HUBS.map((h) => h.name),
      lang,
    ),
  );
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <PageHeader title={t("한산한 코스 추천")} name="raccoon" pose="explore" className="mb-6">
        <KstNote className="mt-1" />
        <p className="mt-1 text-sm text-gray-500">{t("도착할 때 덜 붐비는 순서로 이어 드려요")}</p>
      </PageHeader>
      <RoutePlanner hubs={START_HUBS} names={names} kakao={await kakaoLocalOn()} />
      {/* 코스를 짜지 않고 나가는 방문이 많아(10/26 다음 페이지로 0%) 바로 누를 곳을 사진으로. 서울시청 기준 15km, 한산한 순 */}
      <NearbyRail lat={37.5663} lng={126.9779} lang={lang} maxKm={15} quiet title={t("지금 한산한 서울 명소")} />
      <InlineAd className="mt-8" />
    </main>
  );
}
