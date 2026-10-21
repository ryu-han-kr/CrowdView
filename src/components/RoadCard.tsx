// 진입로 소통 카드: 주변 도로(서울시 도시데이터 또는 국가교통정보센터) · 가까운 고속도로(한국도로공사) 각각 원활/서행/정체 + 평균 속도 + 막히는 도로
import { getT } from "@/i18n/server";
import type { Lang } from "@/i18n/config";
import { Glyph } from "@/components/Glyph";
import { getRoadStatus, type RoadGroup, type RoadLevel, type RoadSource, type RoadStatus } from "@/lib/roads";
import { translateNames } from "@/lib/name-translate";

const COLOR: Record<RoadLevel, { bg: string; fg: string }> = {
  원활: { bg: "#ecfdf5", fg: "#047857" },
  서행: { bg: "#fefce8", fg: "#854d0e" },
  정체: { bg: "#fef2f2", fg: "#b91c1c" },
};

const SOURCE: Record<RoadSource, string> = { seoul: "서울시 실시간 도시데이터", its: "국가교통정보센터", ex: "한국도로공사" };
const LOCAL_LABEL: Record<RoadSource, string> = { seoul: "주변 도로", its: "주변 도로 (약 2km)", ex: "주변 도로" };

/**
 * 위치만 받아 스스로 불러온다. 원본이 가끔 10초 넘게 걸려서 페이지는 <Suspense>로 먼저 보여 주고 이 카드만 늦게 채운다
 */
export async function RoadSection({ lat, lng, lang }: { lat: number; lng: number; lang: Lang }) {
  const roads = await getRoadStatus(lat, lng);
  // 느린 도로 이름(올림픽대로 등)도 외국어 화면에서는 번역 (Papago 캐시)
  if (roads && lang !== "ko") {
    const groups = [roads.local, roads.highway].filter((g): g is RoadGroup => !!g);
    const tr = await translateNames(
      groups.flatMap((g) => g.slowest.map((s) => s.road)),
      lang,
    ).catch(() => new Map<string, string>());
    for (const g of groups) g.slowest = g.slowest.map((s) => ({ ...s, road: tr.get(s.road) ?? s.road }));
  }
  return <RoadCard roads={roads} lang={lang} />;
}

export function RoadCard({ roads, lang, className = "" }: { roads?: RoadStatus; lang: Lang; className?: string }) {
  if (!roads) return null;
  const t = getT(lang);
  const row = (label: string, g?: RoadGroup) =>
    g && (
      <li className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">{t(label)}</p>
          <p className="text-xs text-gray-600">
            {t("평균 {n}km/h", { n: g.avgSpeed })}
            {g.slowest.length > 0 && ` · ${t("느린 곳")} ${g.slowest.map((s) => `${s.road} ${s.speed}km/h`).join(", ")}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: COLOR[g.level].bg, color: COLOR[g.level].fg }}>
          {t(g.level)}
        </span>
      </li>
    );
  return (
    <section className={`card mt-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
        <Glyph e="🚗" className="h-4 w-4 text-indigo-500" /> {t("가는 길 도로 상황")}
      </p>
      <ul className="mt-1 divide-y divide-gray-100">
        {roads.local && row(LOCAL_LABEL[roads.local.source], roads.local)}
        {row("가까운 고속도로 (나들목 8km 안)", roads.highway)}
      </ul>
      <p className="mt-1 text-[11px] text-gray-500">
        {[...new Set([roads.local?.source, roads.highway?.source])]
          .filter((s): s is RoadSource => !!s)
          .map((s) => t(SOURCE[s]))
          .join(" · ")}{" "}
        {t("실시간 구간 속도")}
        {roads.time && ` · ${t("{time} 기준", { time: roads.time })}`}
      </p>
    </section>
  );
}
