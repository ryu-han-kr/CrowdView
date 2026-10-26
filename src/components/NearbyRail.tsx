// 상세 화면 아래 '근처 가볼 곳' 사진 카드 줄 (사용자 10/26: 1명이 페이지 1개만 보고 나간다 → 다음에 누를 곳을 사진으로).
// 우리 장소(실시간·예측 혼잡도)와 대표 명소를 가까운 순으로 섞고, 사진 위에 지금 혼잡도를 붙인다
import { PhotoRail, type PhotoCardItem } from "@/components/home/PhotoRail";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { placeTag } from "@/lib/category-style";
import { getAllCrowd } from "@/lib/crowd/service";
import { distanceKm } from "@/lib/geo";
import { LANDMARKS } from "@/lib/korea";
import { landmarkCard } from "@/lib/korea-cards";
import { heroImage } from "@/lib/place-photos";
import { PLACES, placeHref } from "@/lib/places";
import { getAllSeoulLive } from "@/lib/seoul-live";

/** 이 거리 안만 (지방은 명소 사이가 멀어 넉넉히) */
const MAX_KM = 40;

export async function NearbyRail({
  lat,
  lng,
  lang,
  exclude = [],
  title,
  limit = 10,
}: {
  lat: number;
  lng: number;
  lang: Lang;
  /** 빼고 볼 주소 (지금 보고 있는 화면) */
  exclude?: string[];
  title?: string;
  limit?: number;
}) {
  const t = getT(lang);
  const [crowd, seoul] = await Promise.all([
    getAllCrowd().catch(() => ({}) as Awaited<ReturnType<typeof getAllCrowd>>),
    getAllSeoulLive().catch(() => ({}) as Awaited<ReturnType<typeof getAllSeoulLive>>),
  ]);
  const at = { lat, lng };
  const km = (p: { lat: number; lng: number }) => distanceKm(p, at);
  const places = PLACES.filter((p) => p.category !== "airport" && p.category !== "event" && heroImage(p) && crowd[p.id]).map(
    (p): [number, PhotoCardItem] => [
      km(p),
      {
        id: p.id,
        href: placeHref(p),
        img: heroImage(p),
        title: t(p.name),
        sub: t(p.region),
        score: crowd[p.id].open ? crowd[p.id].score : undefined,
        tag: placeTag(p, t),
        favId: p.id,
      },
    ],
  );
  const landmarks = LANDMARKS.map((l): [number, PhotoCardItem] => [km(l), landmarkCard(l, lang, t, crowd, seoul)]);
  const seen = new Set(exclude);
  const items = [...places, ...landmarks]
    .filter(([d]) => d > 0.05 && d < MAX_KM)
    .sort((a, b) => a[0] - b[0])
    .flatMap(([d, it]) => {
      // 명소가 우리 장소로 이어지면 같은 곳이 두 번 나오지 않게 주소로 거른다
      if (seen.has(it.href)) return [];
      seen.add(it.href);
      return [{ ...it, sub: `${it.sub ? `${it.sub} · ` : ""}${t("{km}km", { km: d < 10 ? d.toFixed(1) : d.toFixed(0) })}` }];
    })
    .slice(0, limit);
  if (items.length < 2) return null;
  return <PhotoRail title={title ?? t("근처 가볼 곳")} subtitle={t("가까운 순 · 사진 위는 지금 혼잡도")} items={items} />;
}
