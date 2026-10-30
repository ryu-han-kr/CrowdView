// 매일 비용 정산 리포트: 서비스별 이번 달 비용과 사용량을 모은다.
import { aiCostByDay, USD_KRW } from "../ai-cost";
import { getApiUsage, type ApiUsage } from "../api-quota";
import { kv } from "../cache";
import { addDays, kst } from "../time";
import { costAiNote } from "./ai-note";
import { getDailyUsage, getMonthDemand, type DailyUsage } from "./ncp";

// 네이버 지도 무료 한도 (월, 대표 계정 기준)와 초과 단가 (원/건)
const NAVER_FREE: Record<string, { free: number; unitPrice?: number }> = {
  MPDNM_MAPS: { free: 10_000_000, unitPrice: 0.1 }, // Dynamic Map
  MPGEO_MAPS: { free: 3_000_000 }, // Geocoding
};

// 아직 API로 집계하지 않는 서비스의 월 고정비 (원). 서비스를 도입하면 금액을 갱신한다
// 네이버 클라우드(지도·Papago)는 위 NCP 청구 금액에 이미 들어 있다
const FIXED_MONTHLY: { name: string; note: string; krw: number }[] = [
  { name: "Vercel", note: "Pro $20 (Spend Management 상한 $50)", krw: 28_000 },
  // 10/20 Pay as you go로 전환 (10만 명령당 $0.2, 상한 $20). 빌드 중 저장 생략 뒤 예상 월 50~150만 명령
  { name: "Upstash Redis", note: "Pay as you go 10만 명령당 $0.2 (월 상한 $20)", krw: 3_000 },
  { name: "Neon Postgres", note: "Free (0.5GB)", krw: 0 },
  { name: "Cloudflare R2", note: "5분 원본 보관, 10GB까지 무료 (1년 약 1.1GB)", krw: 0 },
  { name: "Sentry", note: "Developer 무료 (월 5천 오류)", krw: 0 },
  { name: "Resend", note: "무료 (월 3,000통)", krw: 0 },
  { name: "공공데이터·서울시 API", note: "무료 (하루 한도, 2쪽 참고)", krw: 0 },
  { name: "도메인 crowdview.app", note: "Cloudflare 연 약 $14 (월할)", krw: 1_700 },
  { name: "토스페이먼츠", note: "결제액의 약 3.74% (카드 3.4% + 부가세)", krw: 0 },
];

export interface UsageLine {
  name: string;
  latestDay: number;
  monthToDate: number;
  unit: string;
  free?: number;
  overageKrw?: number;
}

export interface CostReport {
  generatedAt: string;
  generatedAtKst: string; // YYYY-MM-DD HH:mm
  periodEnd: string; // 집계 마지막 날 (어제, YYYY-MM-DD)
  month: string; // YYYY-MM
  latestDate: string | null; // NCP에 사용량이 집계된 가장 최근 날짜
  daysInMonth: number;
  daysElapsed: number;
  naver: { demandKrw: number; usage: UsageLine[] } | { error: string };
  fixed: typeof FIXED_MONTHLY;
  /** 어제 API별 원본 호출 수 (한도 대비) */
  apiUsage: ApiUsage[];
  monthToDateKrw: number;
  projectedKrw: number;
  /** 평소보다 튄 API를 AI가 한두 줄로 (lib/billing/ai-note). 튄 게 없으면 없다 */
  aiNote?: string;
  /** Claude API 이번 달 누적·어제 (토큰·웹 검색으로 계산, lib/ai-cost — 10/30부터 집계) */
  claude: { monthKrw: number; yesterdayKrw: number };
  /** 항목별 이번 달 누적 (원) — 전날 보고서와 비교하는 기준 */
  items: Record<string, number>;
  /** 전날 보고서 대비 (경수님 10/30: 비용이 왜 늘었는지 안 보였다). 전날 기록이 없으면 없다 */
  change?: { projectedKrw: number; items: { name: string; krw: number }[] };
}

// 항목별 누적을 날마다 남겨 다음 날 보고서가 '무엇이 늘었나'를 계산한다
const snapKey = (date: string) => `cost:snap:${date}`;
interface Snap {
  projectedKrw: number;
  items: Record<string, number>;
}

const compact = (d: string) => d.replaceAll("-", "");

export async function buildCostReport(now = new Date()): Promise<CostReport> {
  // 어제까지를 이번 달 집계 범위로 본다 (1일에 실행되면 지난달 전체)
  const yesterday = kst(new Date(now.getTime() - 86_400_000)).date;
  const month = yesterday.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const daysElapsed = Number(yesterday.slice(8, 10));

  let naver: CostReport["naver"];
  let latestDate: string | null = null;
  try {
    const [rows, demandKrw] = await Promise.all([getDailyUsage(compact(`${month}-01`), compact(yesterday)), getMonthDemand(compact(month))]);
    latestDate = rows.reduce<string | null>((max, r) => (!max || r.date > max ? r.date : max), null);
    naver = { demandKrw, usage: summarize(rows, latestDate) };
  } catch (e) {
    naver = { error: e instanceof Error ? e.message : String(e) };
  }

  const apiUsage = await getApiUsage(yesterday);
  const aiNote = await costAiNote(yesterday, apiUsage).catch(() => undefined);
  const fixedKrw = FIXED_MONTHLY.reduce((s, f) => s + f.krw, 0);
  const naverKrw = "error" in naver ? 0 : naver.demandKrw;
  const overageKrw = "error" in naver ? 0 : naver.usage.reduce((s, u) => s + (u.overageKrw ?? 0), 0);
  // 청구액이 아직 확정 전이면 무료 한도 초과분 추정치를 쓴다
  const naverToDate = Math.max(naverKrw, overageKrw);
  // Claude: 이번 달 1일~어제
  const monthDays = Array.from({ length: daysElapsed }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const claudeUsd = await aiCostByDay(monthDays).catch(() => monthDays.map(() => 0));
  const claude = { monthKrw: Math.round(claudeUsd.reduce((a, b) => a + b, 0) * USD_KRW), yesterdayKrw: Math.round((claudeUsd.at(-1) ?? 0) * USD_KRW) };
  const fixedToDate = (fixedKrw * daysElapsed) / daysInMonth;
  const monthToDateKrw = Math.round(naverToDate + claude.monthKrw + fixedToDate);
  const projectedKrw = Math.round(((naverToDate + claude.monthKrw) * daysInMonth) / Math.max(daysElapsed, 1) + fixedKrw);

  // 전날 보고서와 비교: 항목별 누적이 얼마나 늘었나 (고정비는 날마다 같은 만큼 늘어 따로 묶는다)
  const items: Record<string, number> = { "네이버 클라우드": Math.round(naverToDate), "Claude API": claude.monthKrw, "고정비 (일할)": Math.round(fixedToDate) };
  const prev = await kv
    .get(snapKey(addDays(yesterday, -1)))
    .then((x) => (x ? (JSON.parse(String(x)) as Snap) : null))
    .catch(() => null);
  // 1일 보고서는 새 달이라 비교하지 않는다
  const change =
    prev && daysElapsed > 1
      ? {
          projectedKrw: projectedKrw - prev.projectedKrw,
          items: Object.entries(items)
            .map(([name, krw]) => ({ name, krw: krw - (prev.items[name] ?? 0) }))
            .filter((x) => x.krw !== 0)
            .sort((a, b) => b.krw - a.krw),
        }
      : undefined;
  await kv.set(snapKey(yesterday), JSON.stringify({ projectedKrw, items } satisfies Snap), 40 * 86_400).catch(() => {});

  return {
    generatedAt: now.toISOString(),
    generatedAtKst: new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 16).replace("T", " "),
    periodEnd: yesterday,
    month,
    latestDate,
    daysInMonth,
    daysElapsed,
    naver,
    fixed: FIXED_MONTHLY,
    apiUsage,
    monthToDateKrw,
    projectedKrw,
    aiNote,
    claude,
    items,
    change,
  };
}

function summarize(rows: DailyUsage[], latestDate: string | null): UsageLine[] {
  const byCode = new Map<string, UsageLine>();
  for (const r of rows) {
    const line = byCode.get(r.code) ?? { name: r.name, latestDay: 0, monthToDate: 0, unit: r.unit };
    line.monthToDate += r.quantity;
    if (r.date === latestDate) line.latestDay += r.quantity;
    byCode.set(r.code, line);
  }
  for (const [code, line] of byCode) {
    const tier = NAVER_FREE[code];
    if (!tier) continue;
    line.free = tier.free;
    if (tier.unitPrice) line.overageKrw = Math.max(0, line.monthToDate - tier.free) * tier.unitPrice;
  }
  return [...byCode.values()];
}

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const WEEKDAY = "일월화수목금토";

// 2026-10-11 (일) 09:00 KST
export function reportStamp(r: CostReport): string {
  const [date, time] = r.generatedAtKst.split(" ");
  return `${date} (${WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]}) ${time} KST`;
}

// 2026-10-01 ~ 2026-10-10 (10/31일)
export function reportPeriod(r: CostReport): string {
  return `${r.month}-01 ~ ${r.periodEnd} (${r.daysElapsed}/${r.daysInMonth}일)`;
}

export function reportTitle(r: CostReport): string {
  return `[CrowdView] 비용 정산 리포트 ${reportStamp(r)}`;
}

// 메시지 본문은 한 줄 요약만, 상세는 첨부 PDF
export function reportSummary(r: CostReport): string {
  const naver = "error" in r.naver ? " · ⚠️ 네이버 클라우드 조회 실패" : "";
  const change = changeLine(r);
  const near = apiWarnings(r);
  const api = near.length
    ? `
⚠️ API 한도 70% 이상: ${near.join(", ")}`
    : "";
  return `📄 CrowdView 비용 정산 리포트 · ${reportStamp(r)}
이번 달 누적 ${won(r.monthToDateKrw)} · 월말 예상 ${won(r.projectedKrw)}${naver}${change ? `
${change}` : ""}${api}${r.aiNote ? `
🤖 ${r.aiNote}` : ""}`;
}

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${won(Math.abs(n))}`;

/** '어제 보고서보다 월말 예상 +1,234원 — 늘어난 곳: Claude API +800원, 네이버 클라우드 +300원' */
export function changeLine(r: CostReport): string | undefined {
  if (!r.change) return undefined;
  const up = r.change.items.filter((x) => x.krw > 0);
  return `어제 보고서보다 월말 예상 ${signed(r.change.projectedKrw)}${up.length ? ` — 늘어난 곳: ${up.map((x) => `${x.name} ${signed(x.krw)}`).join(", ")}` : ""}`;
}

/** 어제 한도의 70% 넘게 쓴 API */
export function apiWarnings(r: CostReport): string[] {
  return r.apiUsage.filter((a) => (a.pct ?? 0) >= 70).map((a) => `${a.name} ${Math.round(a.pct!)}%`);
}
