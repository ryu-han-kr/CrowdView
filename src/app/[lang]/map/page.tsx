import type { Metadata } from "next";
import { MapExplorer, type ExploreSpot } from "@/components/map/MapExplorer";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { getAllCrowd } from "@/lib/crowd/service";
import { festivalHref, festivalStatus, getFestivalCrowd, getFestivals, isLongRunning } from "@/lib/festivals";
import { distanceKm, type LatLng } from "@/lib/geo";
import { LANDMARKS, LANDMARK_KINDS, REGIONS, inRegion, landmarkLink } from "@/lib/korea";
import { PLACES, placeHref } from "@/lib/places";
import { pageMeta } from "@/lib/seo";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { SEOUL_GROUPS, getAllSeoulLive, seoulGroup } from "@/lib/seoul-live";
import { kst, addDays, shortDate } from "@/lib/time";
import { CATEGORY_LABEL } from "@/lib/types";

// ISR: CDN이 5분 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
// (60초였을 때 ISR 쓰기 5일에 13만 건. 데이터는 10분마다 갱신되니 5분이면 충분)
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getT(lang);
  return pageMeta({
    lang,
    path: "/map",
    title: t("혼잡도 지도"),
    description: t("전국·수도권·부산·제주 장소별 실시간 혼잡도를 지도에서 색으로 확인하세요"),
  });
}

const regionOf = (region: string) => REGIONS.find((r) => inRegion(region, r.id))?.id ?? region.split(" ")[0];

export default async function MapPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const today = kst().date;
  const [crowd, seoul, festivals] = await Promise.all([getAllCrowd(), getAllSeoulLive(), getFestivals(30).catch(() => [])]);

  // 명소·축제 근처의 지금 혼잡: 1.5km 안 우리 장소 → 0.8km 안 서울 실시간 지역
  const nearScore = (p: LatLng): number | undefined => {
    const place = PLACES.find((x) => x.category !== "airport" && crowd[x.id]?.open && distanceKm(x, p) < 1.5);
    if (place) return crowd[place.id].score;
    const area = SEOUL_AREAS.find((a) => seoul[a.code] && distanceKm(a, p) < 0.8);
    return area ? seoul[area.code].score : undefined;
  };

  const spots: ExploreSpot[] = [];
  for (const p of PLACES) {
    const c = crowd[p.id];
    spots.push({
      id: p.id,
      theme: "live",
      region: regionOf(p.region),
      name: t(p.name),
      lat: p.lat,
      lng: p.lng,
      href: placeHref(p),
      score: c?.open ? c.score : undefined,
      emoji: p.emoji,
      sub: `${t(CATEGORY_LABEL[p.category])} · ${c?.open ? t("지금") : t("운영 종료")}`,
      img: p.image,
    });
  }
  for (const a of SEOUL_AREAS) {
    const live = seoul[a.code];
    if (!live) continue;
    const g = SEOUL_GROUPS.find((x) => x.id === seoulGroup(a.name));
    spots.push({
      id: `seoul-${a.code}`,
      theme: "seoul",
      region: "서울",
      name: a.name,
      lat: a.lat,
      lng: a.lng,
      href: `/seoul/${a.code}`,
      score: live.score,
      emoji: g?.emoji ?? "📍",
      sub: `${g ? t(g.label) : ""} · ${t("서울시 실시간")}`,
    });
  }
  for (const l of LANDMARKS) {
    const kind = LANDMARK_KINDS.find((k) => k.id === l.kind)!;
    spots.push({
      id: `lm-${l.id}`,
      theme: "landmark",
      region: l.region,
      name: l.n[lang] ?? l.n.ko,
      lat: l.lat,
      lng: l.lng,
      href: landmarkLink(l, lang).href,
      score: nearScore(l),
      emoji: kind.emoji,
      sub: `${t(l.region)} · ${t(kind.label)}`,
      img: l.img,
    });
  }
  // 전국 명소 디렉터리(1,852곳)는 화면에서 /data/spots.json 으로 받는다 (HTML을 가볍게)
  // 축제: 앞으로 2주 안에 열리는 곳은 작년 방문객 기준 예상 혼잡 (그 뒤는 회색)
  const soon = addDays(today, 14);
  const shownFestivals = festivals.filter((f) => f.lat && f.lng && !isLongRunning(f));
  const fcrowd = await Promise.all(shownFestivals.map((f) => (f.start <= soon ? getFestivalCrowd(f).catch(() => undefined) : undefined)));
  shownFestivals.forEach((f, i) => {
    const on = festivalStatus(f, today) === "ongoing";
    spots.push({
      id: `fe-${f.id}`,
      theme: "festival",
      region: regionOf(f.region),
      name: f.title,
      lat: f.lat!,
      lng: f.lng!,
      href: festivalHref(f),
      score: (on && nearScore(f as LatLng)) || fcrowd[i]?.score,
      emoji: "🎪",
      sub: `${on ? t("진행 중") : `${shortDate(f.start)}~`} · ${f.region}`,
      img: f.image,
    });
  });

  return (
    <main className="pt-5 md:pt-8">
      <h1 className="px-5 text-2xl font-bold md:px-0 md:text-3xl">{t("혼잡도 지도")}</h1>
      <div className="mt-1">
        <MapExplorer
          spots={spots}
          regions={REGIONS.map((r) => r.id)}
          subtitle={t("테마와 지역을 골라 보세요. 핀 색은 지금 혼잡 단계(축제는 예상), 회색은 혼잡 자료가 없는 곳이에요.")}
        />
      </div>
    </main>
  );
}
