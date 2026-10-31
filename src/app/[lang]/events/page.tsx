import { InlineAd } from "@/components/AdUnit";
import { FestivalList } from "@/components/FestivalList";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getT as getMetaT } from "@/i18n/server";
import { festivalHref, getFestivalCrowd, getFestivalLive, getFestivals, isLongRunning, seoulAreaOf, type FestivalCrowd } from "@/lib/festivals";
import type { SeoulLive } from "@/lib/seoul-live";
import { addDays, kst } from "@/lib/time";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { translateNames } from "@/lib/name-translate";
import { PageHeader } from "@/components/PageHeader";

// 축제 일정은 6시간마다 바뀌어 1시간 단위로 다시 렌더링해도 충분하다
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getMetaT(lang);
  return pageMeta({
    lang,
    path: "/events",
    title: t("전국 축제 일정 · 혼잡 예측"),
    description: t("이번 달 전국 축제 일정과 지역·종류별 목록, 작년 방문객으로 본 예상 혼잡도"),
  });
}

export default async function EventsPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const today = kst().date;
  const festivals = await getFestivals(60);
  // 혼잡 예측은 30일 안에 열리는 축제만 (작년 방문객 데이터를 날짜별로 받아야 해서)
  const soon = festivals.filter((f) => f.start <= addDays(today, 30) && !isLongRunning(f)).slice(0, 60);
  const crowds: Record<string, FestivalCrowd | null> = {};
  await Promise.all(soon.map(async (f) => (crowds[f.id] = (await getFestivalCrowd(f)) ?? null)));
  const hrefs = Object.fromEntries(festivals.map((f) => [f.id, festivalHref(f)]));
  // 진행 중인 서울 축제는 서울시 실시간 인구로 (장소 800m 안의 실시간 지역)
  const lives: Record<string, SeoulLive | null> = {};
  await Promise.all(
    festivals.filter((f) => f.start <= today && seoulAreaOf(f)).map(async (f) => (lives[f.id] = (await getFestivalLive(f)) ?? null)),
  );
  const liveAreas = Object.fromEntries(festivals.flatMap((f) => (seoulAreaOf(f) ? [[f.id, seoulAreaOf(f)!.name]] : [])));
  // 축제 이름·지역명 번역 (Papago, Redis 캐시)
  const names = Object.fromEntries(
    await translateNames([...festivals.flatMap((f) => [f.title, f.region]), ...Object.values(liveAreas)], lang),
  );

  return (
    <main className="px-5 pt-6 pb-8 md:px-0 md:pt-10">
      <PageHeader title={t("전국 축제")} name="rabbit" pose="done">
        <p className="mt-1 text-sm text-gray-500">
          {t("축제 {n}개 · 서울은 실시간, 그 외는 예측", { n: festivals.length })}
        </p>
      </PageHeader>
      <FestivalList
        festivals={festivals}
        crowds={crowds}
        lives={lives}
        liveAreas={liveAreas}
        hrefs={hrefs}
        today={today}
        names={names}
      />
      <InlineAd className="mt-6" />
      <p className="mt-6 text-center text-[11px] text-gray-500">
        {t("일정: 한국관광공사 TourAPI, 서울시 문화행사 정보 · 실시간: 서울시 실시간 도시데이터 · 혼잡 예측: 한국관광공사 데이터랩(이동통신 방문자)")}
      </p>
    </main>
  );
}
