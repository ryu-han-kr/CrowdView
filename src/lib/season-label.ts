/** 비시즌 표시: '12월 오픈 예정' / 개장일이 발표됐으면 '11/28 오픈 예정' (opens = 'MM' 또는 'MM-DD', crowd/model opensOf) */
export function offSeasonLabel(opens: string | undefined, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (!opens) return t("시즌 아님");
  const [m, d] = opens.split("-").map(Number);
  return d ? t("{date} 오픈 예정", { date: `${m}/${d}` }) : t("{m}월 오픈 예정", { m });
}
