import type { Metadata } from "next";
import { RoutePlanner } from "@/components/RoutePlanner";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { translateNames } from "@/lib/name-translate";
import { START_HUBS } from "@/lib/route-data";
import { kakaoLocalOn } from "@/lib/kakao-local";
import { pageMeta } from "@/lib/seo";
import { KstNote } from "@/components/LocalTime";

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
      <h1 className="text-2xl font-bold md:text-3xl">{t("한산한 코스 추천")}</h1>
      <KstNote className="mt-1" />
      <p className="mt-1 mb-6 text-sm text-gray-500">{t("가고 싶은 종류와 시간만 고르면, 도착할 때 덜 붐비는 순서로 이어 드려요")}</p>
      <RoutePlanner hubs={START_HUBS} names={names} kakao={await kakaoLocalOn()} />
    </main>
  );
}
