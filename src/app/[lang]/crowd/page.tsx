import type { Metadata } from "next";
import Link from "@/i18n/link";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { searchName } from "@/components/StayLinks";
import { getAllCrowd } from "@/lib/crowd/service";
import { CROWD_PAGES } from "@/lib/crowd-pages";
import { inkOf, levelOf } from "@/lib/levels";
import { translateNames } from "@/lib/name-translate";
import { PLACES } from "@/lib/places";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { getAllSeoulLive } from "@/lib/seoul-live";
import { pageMeta } from "@/lib/seo";

// 질문형 페이지 모음 ("Is it crowded right now?"): 장소·서울 지역마다 지금 단계와 링크. 검색엔진이 개별 페이지를 찾는 입구
export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getT(lang);
  return pageMeta({
    lang,
    path: "/crowd",
    title: t("지금 붐비나요? 한국 명소·공항·놀이공원 실시간 혼잡도"),
    description: t("명동·홍대·경복궁·롯데월드·에버랜드·인천공항 등 160곳이 지금 붐비는지, 언제 가면 한산한지 한 번에 확인하세요."),
  });
}

export default async function CrowdIndex({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const [crowd, seoul, names] = await Promise.all([
    getAllCrowd().catch(() => ({}) as Awaited<ReturnType<typeof getAllCrowd>>),
    getAllSeoulLive().catch(() => ({}) as Awaited<ReturnType<typeof getAllSeoulLive>>),
    translateNames(
      SEOUL_AREAS.map((a) => a.name),
      lang,
    ),
  ]);
  const rows = CROWD_PAGES.map((p) => {
    if (p.kind === "place") {
      const pl = PLACES.find((x) => x.id === p.id)!;
      const c = crowd[p.id];
      return { p, name: t(pl.name), score: c?.open ? c.score : undefined };
    }
    const ko = SEOUL_AREAS.find((x) => x.code === p.id)!.name;
    const s = seoul[p.id];
    return { p, name: searchName(lang === "ko" ? ko : lang === "en" ? p.en : (names.get(ko) ?? p.en)), score: s?.score };
  });
  const Group = ({ title, list }: { title: string; list: typeof rows }) => (
    <section className="mt-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => {
          const lv = r.score !== undefined ? levelOf(r.score) : undefined;
          return (
            <li key={r.p.slug}>
              <Link href={`/crowd/${r.p.slug}`} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
                <span className="min-w-0 truncate font-semibold">{t("{name} 지금 붐비나요?", { name: r.name })}</span>
                <span className="shrink-0 text-sm font-bold" style={{ color: lv ? inkOf(lv.color) : "#6b7280" }}>
                  {lv ? t(lv.label) : t("운영 종료")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <PageHeader title={t("지금 붐비나요?")} name="hamster" pose="explore" className="mb-2">
        <p className="mt-1 text-sm text-gray-600">{t("누르면 지금 혼잡도와 가기 좋은 때를 알려 드려요")}</p>
      </PageHeader>
      <Group title={t("공항·놀이공원·장소")} list={rows.filter((r) => r.p.kind === "place")} />
      <Group title={t("서울 실시간 지역")} list={rows.filter((r) => r.p.kind === "seoul")} />
    </main>
  );
}
