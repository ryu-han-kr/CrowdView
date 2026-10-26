// 상세 화면 아래 '근처 가볼 곳' 사진 카드 줄 (사용자 10/26: 1명이 페이지 1개만 보고 나간다 → 다음에 누를 곳을 사진으로).
// 우리 장소(실시간·예측 혼잡도)와 대표 명소를 가까운 순으로 섞고, 사진 위에 지금 혼잡도를 붙인다
import Link from "@/i18n/link";
import { PhotoRail, type PhotoCardItem } from "@/components/home/PhotoRail";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { placeTag } from "@/lib/category-style";
import { getAllCrowd } from "@/lib/crowd/service";
import { distanceKm } from "@/lib/geo";
import { LANDMARKS } from "@/lib/korea";
import { landmarkCard } from "@/lib/korea-cards";
import { inkOf, levelOf } from "@/lib/levels";
import { heroImage } from "@/lib/place-photos";
import { PLACES, placeHref } from "@/lib/places";
import { getAllSeoulLive } from "@/lib/seoul-live";

/** 이 거리 안만 (지방은 명소 사이가 멀어 넉넉히) */
const MAX_KM = 40;

interface NearbyOpts {
  lat: number;
  lng: number;
  lang: Lang;
  /** 빼고 볼 주소 (지금 보고 있는 화면) */
  exclude?: string[];
  limit?: number;
  maxKm?: number;
  /** 가까운 순 대신 지금 한산한 순 (혼잡도를 모르는 곳은 뒤로) */
  quiet?: boolean;
}

async function nearbyItems({ lat, lng, lang, exclude = [], limit = 10, maxKm = MAX_KM, quiet }: NearbyOpts) {
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
  const near = [...places, ...landmarks].filter(([d]) => d > 0.05 && d < maxKm).sort((a, b) => a[0] - b[0]);
  if (quiet) near.sort((a, b) => (a[1].score ?? 101) - (b[1].score ?? 101));
  return near
    .flatMap(([d, it]) => {
      // 명소가 우리 장소로 이어지면 같은 곳이 두 번 나오지 않게 주소로 거른다
      if (seen.has(it.href)) return [];
      seen.add(it.href);
      return [{ ...it, sub: `${it.sub ? `${it.sub} · ` : ""}${t("{km}km", { km: d < 10 ? d.toFixed(1) : d.toFixed(0) })}`, km: d }];
    })
    .slice(0, limit);
}

export async function NearbyRail({ title, subtitle, ...opts }: NearbyOpts & { title?: string; subtitle?: string }) {
  const t = getT(opts.lang);
  const items = await nearbyItems(opts);
  if (items.length < 2) return null;
  return (
    <PhotoRail
      title={title ?? t("근처 가볼 곳")}
      subtitle={subtitle ?? (opts.quiet ? t("한산한 순 · 사진 위는 지금 혼잡도") : t("가까운 순 · 사진 위는 지금 혼잡도"))}
      items={items}
    />
  );
}

/** 혼잡도 카드 바로 아래 한 줄 바로가기 (사용자 10/26: 장소·서울 화면으로 들어온 방문은 다음 페이지로 0% → 아래 사진 줄까지 안 내려간다) */
export async function NearbyChips({ className = "", ...opts }: NearbyOpts & { className?: string }) {
  const t = getT(opts.lang);
  const items = await nearbyItems({ limit: 4, maxKm: 15, ...opts });
  if (items.length < 2) return null;
  return (
    <nav aria-label={t("근처 가볼 곳")} className={`flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] ${className}`}>
      <span className="shrink-0 self-center text-[13px] font-bold text-gray-500">{t("근처")}</span>
      {items.map((it) => {
        const lv = it.score !== undefined ? levelOf(it.score) : undefined;
        return (
          <Link
            key={it.href}
            href={it.href}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-800 hover:border-gray-300"
          >
            {lv && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: lv.color }} />}
            <span className="max-w-[9rem] truncate">{it.title}</span>
            {lv && (
              <span className="text-[12px]" style={{ color: inkOf(lv.color) }}>
                {t(lv.label)}
              </span>
            )}
            <span className="text-[12px] font-medium text-gray-500">{t("{km}km", { km: it.km < 10 ? it.km.toFixed(1) : it.km.toFixed(0) })}</span>
          </Link>
        );
      })}
    </nav>
  );
}
