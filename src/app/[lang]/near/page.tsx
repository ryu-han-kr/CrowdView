import type { Metadata } from "next";
import { NearbyFinder } from "@/components/NearbyFinder";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { translateNames } from "@/lib/name-translate";
import { START_HUBS } from "@/lib/route-data";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getT(lang);
  return pageMeta({
    lang,
    path: "/near",
    title: t("서울 내 주변 화장실·와이파이·맛집 찾기"),
    description: t("지금 위치에서 가장 가까운 공중화장실(24시간·장애인·기저귀 교환대), 무료 와이파이, 명소·맛집, 문화공간, 체험 예약을 찾아요"),
  });
}

export default async function NearPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const names = Object.fromEntries(await translateNames(START_HUBS.map((h) => h.name), lang));
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold md:text-3xl">{t("내 주변 찾기")}</h1>
        <p className="mt-1 mb-5 text-sm text-gray-500">{t("화장실·와이파이·명소·맛집·문화공간을 가까운 순으로")}</p>
        <NearbyFinder hubs={START_HUBS} names={names} />
      </div>
    </main>
  );
}
