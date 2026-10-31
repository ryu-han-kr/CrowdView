// 웹 조사로 모은 '알려진 혼잡 정보' (lib/research-facts). 실측·예측과 섞이지 않게 따로, 출처를 곁에 둔다
import type { Lang } from "@/i18n/config";
import { formatHour, type T } from "@/i18n/translate";
import { compactNumber } from "@/lib/format";
import type { ResearchDay, ResearchFacts } from "@/lib/research-facts";

const DAY_IDX: Record<Exclude<ResearchDay, "holiday">, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-14 shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** tips·wait·trig는 한국어 원문 → 외국어 화면은 호출부에서 번역해 넘긴다 */
export function ResearchFactsBlock({ f, lang, t, text }: { f: ResearchFacts; lang: Lang; t: T; text: (s: string) => string }) {
  const month = (m: number) => new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, m - 1, 15)));
  // 2026-11-01은 일요일
  const day = (d: ResearchDay) =>
    d === "holiday" ? t("공휴일") : new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 1 + DAY_IDX[d])));
  const hours = (ws?: [number, number][]) => ws?.map(([a, b]) => `${formatHour(a, lang)}–${formatHour(b, lang)}`).join(", ");
  const when = (ms?: number[], ds?: ResearchDay[], hs?: [number, number][]) =>
    [ms?.map(month).join("·"), ds?.map(day).join("·"), hours(hs)].filter(Boolean).join(" / ");
  const busy = when(f.pm, f.bd, f.bh);
  const calm = when(f.qm, f.qd, f.qh);
  const v = f.vis?.[0];
  const domains = [...new Set((f.src ?? []).map((u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } }).filter(Boolean))].slice(0, 3);
  if (!busy && !calm && !v && !f.wait?.length && !f.tips?.length) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      <p className="text-xs font-semibold text-gray-700">{t("알려진 혼잡 정보")}</p>
      {v && (
        <Row label={t("연간 방문")}>
          {t("{n}명", { n: compactNumber(v.n, lang) })} <span className="text-gray-500">({v.y})</span>
          {f.vis!.length > 1 && (
            <span className="text-xs text-gray-500">
              {" · "}
              {f.vis!.slice(1, 3).map((x) => `${x.y} ${compactNumber(x.n, lang)}`).join(", ")}
            </span>
          )}
        </Row>
      )}
      {busy && <Row label={t("붐비는 때")}>{busy}</Row>}
      {calm && <Row label={t("한산한 때")}>{calm}</Row>}
      {!!f.wait?.length && <Row label={t("대기")}>{text(f.wait[0])}</Row>}
      {!!f.tips?.length && (
        <Row label={t("팁")}>
          <ul className="list-disc space-y-0.5 pl-4">
            {f.tips.slice(0, 3).map((x) => (
              <li key={x}>{text(x)}</li>
            ))}
          </ul>
        </Row>
      )}
      <p className="pl-17 text-xs text-gray-500">
        {t("언론·통계·방문 후기를 모아 정리한 경향이에요")}
        {domains.length > 0 && (
          <>
            {" · "}
            {domains.map((d, i) => (
              <a key={d} href={f.src!.find((u) => u.includes(d))} target="_blank" rel="noreferrer nofollow" className="underline underline-offset-2">
                {d}
                {i < domains.length - 1 ? ", " : ""}
              </a>
            ))}
          </>
        )}
      </p>
    </div>
  );
}
