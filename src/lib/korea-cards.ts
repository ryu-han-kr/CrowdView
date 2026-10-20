// 홈·지역 여행 화면의 사진 카드 만들기 (서버). 랜드마크·축제를 PhotoCardItem 으로 바꾼다
import type { PhotoCardItem } from "@/components/home/PhotoRail";
import type { Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";
import { trRegion } from "@/i18n/patterns";
import { getAllCrowd } from "./crowd/service";
import { festivalHref, festivalStatus, type Festival } from "./festivals";
import { LANDMARK_KINDS, landmarkLink, type Landmark } from "./korea";
import { getAllSeoulLive } from "./seoul-live";
import { daysUntil } from "./time";

type Crowd = Awaited<ReturnType<typeof getAllCrowd>>;
type Seoul = Awaited<ReturnType<typeof getAllSeoulLive>>;

/** 랜드마크 카드: 가까운 우리 장소·서울 실시간 지역이 있으면 지금 혼잡도를 붙인다 */
export function landmarkCard(l: Landmark, lang: Lang, t: T, crowd: Crowd, seoul: Seoul): PhotoCardItem {
  const link = landmarkLink(l, lang);
  const c = link.placeId ? crowd[link.placeId] : undefined;
  const score = c?.open ? c.score : link.seoulCode ? seoul[link.seoulCode]?.score : undefined;
  const kind = LANDMARK_KINDS.find((k) => k.id === l.kind)!;
  return {
    id: `lm-${l.id}`,
    href: link.href,
    external: link.external,
    img: l.img,
    title: l.n[lang] ?? l.n.ko,
    sub: `${t(l.region)} · ${t(kind.label)}`,
    score,
    lat: l.lat,
    lng: l.lng,
  };
}

/** 축제 카드. names: 축제 이름·지역 번역 (Papago 캐시) */
export function festivalCard(f: Festival, t: T, today: string, names: Map<string, string>, ratio?: number): PhotoCardItem {
  return {
    id: f.id,
    href: festivalHref(f),
    img: f.image,
    emoji: "🎪",
    title: names.get(f.title) ?? f.title,
    sub: `${f.start.slice(5).replace("-", "/")}~${f.end.slice(5).replace("-", "/")} · ${names.get(f.region) ?? trRegion(f.region, t)}`,
    badge: festivalStatus(f, today) === "ongoing" ? t("진행 중") : `D-${daysUntil(f.start)}`,
    note: ratio && ratio >= 1.2 ? t("평소보다 {n}배 붐빔 예상", { n: ratio.toFixed(1) }) : undefined,
    lat: f.lat,
    lng: f.lng,
  };
}
