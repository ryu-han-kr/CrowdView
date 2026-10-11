// 매일 비용 정산 리포트: 서비스별 이번 달 비용과 사용량을 모은다.
import { kst } from "../time";
import { getDailyUsage, getMonthDemand, type DailyUsage } from "./ncp";

// 네이버 지도 무료 한도 (월, 대표 계정 기준)와 초과 단가 (원/건)
const NAVER_FREE: Record<string, { free: number; unitPrice?: number }> = {
  MPDNM_MAPS: { free: 10_000_000, unitPrice: 0.1 }, // Dynamic Map
  MPGEO_MAPS: { free: 3_000_000 }, // Geocoding
};

// 아직 API로 집계하지 않는 서비스의 월 고정비 (원). 서비스를 도입하면 금액을 갱신한다
const FIXED_MONTHLY: { name: string; note: string; krw: number }[] = [
  { name: "Vercel", note: "Hobby (Pro 전환 시 $20)", krw: 0 },
  { name: "Supabase", note: "미사용", krw: 0 },
  { name: "Upstash Redis", note: "미사용 (인메모리 캐시)", krw: 0 },
  { name: "Resend", note: "무료 (월 3,000통)", krw: 0 },
  { name: "Claude API", note: "미사용", krw: 0 },
  { name: "토스페이먼츠", note: "미연동", krw: 0 },
  { name: "도메인", note: "없음", krw: 0 },
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
  month: string; // YYYY-MM
  latestDate: string | null; // NCP에 사용량이 집계된 가장 최근 날짜
  daysInMonth: number;
  daysElapsed: number;
  naver: { demandKrw: number; usage: UsageLine[] } | { error: string };
  fixed: typeof FIXED_MONTHLY;
  monthToDateKrw: number;
  projectedKrw: number;
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
    const [rows, demandKrw] = await Promise.all([
      getDailyUsage(compact(`${month}-01`), compact(yesterday)),
      getMonthDemand(compact(month)),
    ]);
    latestDate = rows.reduce<string | null>((max, r) => (!max || r.date > max ? r.date : max), null);
    naver = { demandKrw, usage: summarize(rows, latestDate) };
  } catch (e) {
    naver = { error: e instanceof Error ? e.message : String(e) };
  }

  const fixedKrw = FIXED_MONTHLY.reduce((s, f) => s + f.krw, 0);
  const naverKrw = "error" in naver ? 0 : naver.demandKrw;
  const overageKrw = "error" in naver ? 0 : naver.usage.reduce((s, u) => s + (u.overageKrw ?? 0), 0);
  // 청구액이 아직 확정 전이면 무료 한도 초과분 추정치를 쓴다
  const naverToDate = Math.max(naverKrw, overageKrw);
  const monthToDateKrw = Math.round(naverToDate + (fixedKrw * daysElapsed) / daysInMonth);
  const projectedKrw = Math.round((naverToDate * daysInMonth) / Math.max(daysElapsed, 1) + fixedKrw);

  return {
    generatedAt: now.toISOString(),
    month,
    latestDate,
    daysInMonth,
    daysElapsed,
    naver,
    fixed: FIXED_MONTHLY,
    monthToDateKrw,
    projectedKrw,
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
const num = (n: number) => Math.round(n).toLocaleString("ko-KR");

export function reportTitle(r: CostReport): string {
  return `[CrowdView] ${r.month} 비용 정산 · 누적 ${won(r.monthToDateKrw)} / 월말 예상 ${won(r.projectedKrw)}`;
}

// 디스코드용 마크다운 (2,000자 제한 안쪽)
export function reportMarkdown(r: CostReport): string {
  const lines = [
    `## 💰 CrowdView 비용 정산 (${r.month}, ${r.daysElapsed}/${r.daysInMonth}일)`,
    `**이번 달 누적:** ${won(r.monthToDateKrw)}  ·  **월말 예상:** ${won(r.projectedKrw)}`,
    "",
    "### 네이버 클라우드",
  ];
  if ("error" in r.naver) {
    lines.push(`⚠️ 조회 실패: ${r.naver.error}`);
  } else {
    lines.push(`청구 금액(VAT 포함): **${won(r.naver.demandKrw)}**`);
    for (const u of r.naver.usage) {
      const free = u.free ? ` (무료 한도 ${((u.monthToDate / u.free) * 100).toFixed(2)}%)` : "";
      lines.push(`- ${u.name}: ${r.latestDate ?? "-"} ${num(u.latestDay)}${u.unit} · 이번 달 ${num(u.monthToDate)}${u.unit}${free}`);
    }
  }
  lines.push("", "### 기타 서비스");
  for (const f of r.fixed) lines.push(`- ${f.name}: ${won(f.krw)}/월 · ${f.note}`);
  return lines.join("\n");
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function reportHtml(r: CostReport): string {
  const row = (cells: string[]) => `<tr>${cells.map((c) => `<td style="padding:6px 10px;border-bottom:1px solid #eee">${c}</td>`).join("")}</tr>`;
  const naver =
    "error" in r.naver
      ? `<p style="color:#c00">조회 실패: ${esc(r.naver.error)}</p>`
      : `<p>청구 금액(VAT 포함): <b>${won(r.naver.demandKrw)}</b></p>
<table style="border-collapse:collapse;font-size:14px">
${row(["<b>항목</b>", `<b>${r.latestDate ?? "-"}</b>`, "<b>이번 달</b>", "<b>무료 한도</b>"])}
${r.naver.usage
  .map((u) =>
    row([
      esc(u.name),
      `${num(u.latestDay)}${esc(u.unit)}`,
      `${num(u.monthToDate)}${esc(u.unit)}`,
      u.free ? `${num(u.free)} (${((u.monthToDate / u.free) * 100).toFixed(2)}%)` : "-",
    ]),
  )
  .join("\n")}
</table>`;
  return `<div style="font-family:sans-serif;max-width:560px">
<h2>CrowdView 비용 정산 (${r.month}, ${r.daysElapsed}/${r.daysInMonth}일)</h2>
<p style="font-size:16px">이번 달 누적 <b>${won(r.monthToDateKrw)}</b> · 월말 예상 <b>${won(r.projectedKrw)}</b></p>
<h3>네이버 클라우드</h3>
${naver}
<h3>기타 서비스</h3>
<table style="border-collapse:collapse;font-size:14px">
${r.fixed.map((f) => row([esc(f.name), `${won(f.krw)}/월`, esc(f.note)])).join("\n")}
</table>
<p style="color:#888;font-size:12px">생성 시각 ${r.generatedAt} · 고정비는 일할 계산</p>
</div>`;
}
