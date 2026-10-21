import type { Band } from "@/lib/crowd/percentile";
import type { T } from "@/i18n/translate";

// 백분위 혼잡지수 한 줄: 지금 값이 최근 4주 같은 평일/주말 · 같은 시간(±1시간) 분포의 어디쯤인지 (lib/crowd/percentile)
const TEXT: Record<Band, string> = {
  "much-busier": "최근 4주 {day} 같은 시간보다 훨씬 붐벼요 · 상위 10%",
  busier: "최근 4주 {day} 같은 시간보다 붐벼요 · 상위 25%",
  usual: "최근 4주 {day} 같은 시간과 비슷한 수준이에요",
  quieter: "최근 4주 {day} 같은 시간보다 한산해요 · 하위 25%",
  "much-quieter": "최근 4주 {day} 같은 시간보다 훨씬 한산해요 · 하위 10%",
};
const COLOR: Record<Band, string> = {
  "much-busier": "text-red-700",
  busier: "text-orange-700",
  usual: "text-gray-600",
  quieter: "text-emerald-700",
  "much-quieter": "text-emerald-700",
};

export function UsualBand({ band, weekend, t, className = "" }: { band: Band; weekend: boolean; t: T; className?: string }) {
  return <span className={`${COLOR[band]} ${className}`}>{t(TEXT[band], { day: weekend ? t("주말·공휴일") : t("평일") })}</span>;
}
