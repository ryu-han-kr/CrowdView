// 진입로 소통 카드 (국가교통정보센터 실시간 속도): 주변 도로 · 가까운 고속도로 각각 원활/서행/정체 + 평균 속도 + 막히는 도로
import { getT } from "@/i18n/server";
import type { Lang } from "@/i18n/config";
import { Glyph } from "@/components/Glyph";
import type { RoadGroup, RoadLevel, RoadStatus } from "@/lib/roads";

const COLOR: Record<RoadLevel, { bg: string; fg: string }> = {
  원활: { bg: "#ecfdf5", fg: "#047857" },
  서행: { bg: "#fefce8", fg: "#854d0e" },
  정체: { bg: "#fef2f2", fg: "#b91c1c" },
};

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
        {row("주변 도로 (약 2km)", roads.local)}
        {row("가까운 고속도로 (약 6km)", roads.highway)}
      </ul>
      <p className="mt-1 text-[11px] text-gray-500">
        {t("국가교통정보센터 실시간 구간 속도")}
        {roads.time && ` · ${t("{time} 기준", { time: roads.time })}`}
      </p>
    </section>
  );
}
