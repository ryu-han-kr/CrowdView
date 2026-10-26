import type { Metadata } from "next";
import Link from "@/i18n/link";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { getDailyIndex } from "@/lib/archive-daily";
import { inkOf, levelOf } from "@/lib/levels";
import { translateNames } from "@/lib/name-translate";
import { PLACES } from "@/lib/places";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { pageMeta } from "@/lib/seo";

// 지난 혼잡 기록 첫 화면 (사용자 10/26: 지난 날짜 데이터를 사이트에서도). 기록이 있는 곳만, 장소·서울 지역으로 나눠서
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getT(lang);
  return pageMeta({
    lang,
    path: "/history",
    title: t("지난 혼잡 기록"),
    description: t("공항·놀이공원·서울 121곳의 지난 날짜별 실제 혼잡 기록과 요일·시간대별 평균"),
  });
}

export default async function HistoryIndex({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const index = await getDailyIndex();
  const seoulNames = await translateNames(
    SEOUL_AREAS.map((a) => a.name),
    lang,
  );
  const place = index.filter((r) => r.kind === "place" && PLACES.some((p) => p.id === r.id));
  const seoul = index.filter((r) => r.kind === "seoul" && SEOUL_AREAS.some((a) => a.code === r.id));
  const name = (kind: string, id: string) =>
    kind === "place" ? t(PLACES.find((p) => p.id === id)!.name) : (() => {
      const a = SEOUL_AREAS.find((x) => x.code === id)!;
      return seoulNames.get(a.name) ?? a.name;
    })();
  const List = ({ rows }: { rows: typeof index }) => (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => {
        const lv = levelOf(r.recentAvg);
        return (
          <li key={r.id}>
            <Link href={`/history/${r.kind}/${r.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{name(r.kind, r.id)}</span>
                <span className="text-xs text-gray-500">{t("{n}일 기록 · 마지막 {date}", { n: r.days, date: r.last.slice(5).replace("-", "/") })}</span>
              </span>
              <span className="shrink-0 text-sm font-bold" style={{ color: inkOf(lv.color) }}>
                {t(lv.label)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <PageHeader title={t("지난 혼잡 기록")} name="otter" pose="explore" className="mb-4">
        <p className="mt-1 text-sm text-gray-600">{t("5분마다 모은 실제 혼잡을 날짜별로 정리했어요. 오른쪽은 최근 7일 평균이에요.")}</p>
      </PageHeader>
      {!index.length ? (
        <p className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">{t("기록을 정리하는 중이에요. 내일부터 날짜별로 보여요.")}</p>
      ) : (
        <>
          {place.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-bold">{t("공항·놀이공원·장소")}</h2>
              <List rows={place} />
            </section>
          )}
          {seoul.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">{t("서울 실시간 지역")}</h2>
              <List rows={seoul} />
            </section>
          )}
        </>
      )}
    </main>
  );
}
