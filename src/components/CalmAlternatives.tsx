import Link from "@/i18n/link";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { getAllCrowd } from "@/lib/crowd/service";
import { distanceKm } from "@/lib/geo";
import { levelOf } from "@/lib/levels";
import { translateNames } from "@/lib/name-translate";
import { PLACES, placeHref } from "@/lib/places";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { getAllSeoulLive, seoulGroup } from "@/lib/seoul-live";
import { LevelBadge } from "./Level";
import { Glyph } from "@/components/Glyph";
import { Character } from "@/components/Character";
import type { CharacterName } from "@/lib/characters";

const NEAR_KM = 3;

/**
 * 지금 덜 붐비는 근처 대안 3곳 (외부 검토: '즉시 행동'을 돕는 기능).
 * 3km 안 우리 장소·서울 실시간 지역(역 주변 제외) 중 지금 단계가 이곳보다 낮은 곳을, 한산한 순 → 가까운 순으로
 */
export async function CalmAlternatives({
  lat,
  lng,
  score,
  selfId,
  lang,
  className = "card mt-4",
  character = "hamster",
}: {
  lat: number;
  lng: number;
  /** 이곳의 지금 점수 (없으면 그냥 한산한 순) */
  score?: number;
  /** 빼고 볼 자기 자신 (장소 id 또는 seoul-<코드>) */
  selfId: string;
  lang: Lang;
  className?: string;
  /** 화면 주제 캐릭터 (lib/characters) */
  character?: CharacterName;
}) {
  const t = getT(lang);
  const [crowd, seoul] = await Promise.all([
    getAllCrowd().catch(() => ({}) as Awaited<ReturnType<typeof getAllCrowd>>),
    getAllSeoulLive().catch(() => ({}) as Awaited<ReturnType<typeof getAllSeoulLive>>),
  ]);
  const here = { lat, lng };
  const myLevel = score === undefined ? 99 : levelOf(score).key;
  const items = [
    ...PLACES.filter((p) => p.id !== selfId && p.category !== "airport" && crowd[p.id]?.open).map((p) => ({
      id: p.id,
      name: p.name,
      href: placeHref(p),
      score: crowd[p.id].score,
      km: distanceKm(here, p),
    })),
    ...SEOUL_AREAS.filter((a) => `seoul-${a.code}` !== selfId && seoulGroup(a.name) !== "station" && seoul[a.code]).map((a) => ({
      id: `seoul-${a.code}`,
      name: a.name,
      href: `/seoul/${a.code}`,
      score: seoul[a.code].score,
      km: distanceKm(here, a),
    })),
  ]
    .filter((x) => x.km > 0.3 && x.km <= NEAR_KM && levelOf(x.score).key < myLevel)
    .sort((a, b) => a.score - b.score || a.km - b.km)
    .slice(0, 3);
  if (!items.length) return null;
  const names = await translateNames(
    items.map((x) => x.name),
    lang,
  );

  return (
    <section className={className}>
      <div className="-mt-2 -mb-1 flex items-end justify-between gap-2">
        <p className="flex items-center gap-1.5 pb-2 text-sm font-bold">
          <Glyph e="🌿" className="h-4 w-4 text-emerald-500" /> {t("지금 덜 붐비는 근처 대안")}
        </p>
        <Character name={character} pose="pick" size={64} className="shrink-0" />
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((x) => (
          <li key={x.id}>
            <Link href={x.href} className="card-row flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{names.get(x.name) ?? t(x.name)}</span>
                <span className="block text-xs text-gray-500">{t("여기서 {km}km", { km: x.km.toFixed(1) })}</span>
              </span>
              <LevelBadge score={x.score} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
