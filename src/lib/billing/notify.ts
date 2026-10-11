// 리포트 발송: 디스코드 웹훅 + 이메일(Resend). 본문은 한 줄 요약, 상세는 PDF 첨부
import { reportFilename, renderReportPdf } from "./pdf";
import { reportSummary, reportTitle, type CostReport } from "./report";

interface Payload {
  report: CostReport;
  pdf: Uint8Array;
  filename: string;
}

async function sendDiscord({ report, pdf, filename }: Payload): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) throw new Error("DISCORD_WEBHOOK_URL 미설정");
  const form = new FormData();
  form.append("payload_json", JSON.stringify({ content: reportSummary(report) }));
  form.append("files[0]", new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), filename);
  const res = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`discord ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// 도메인 인증 전에는 onboarding@resend.dev 발신, Resend 가입 이메일로만 수신 가능
async function sendEmail({ report, pdf, filename }: Payload): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL_TO;
  if (!key || !to) throw new Error("RESEND_API_KEY / REPORT_EMAIL_TO 미설정");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.REPORT_EMAIL_FROM ?? "CrowdView <onboarding@resend.dev>",
      to: to.split(",").map((s) => s.trim()),
      subject: reportTitle(report),
      text: `${reportSummary(report)}\n\n상세 내역은 첨부한 PDF(${filename})를 확인하세요.`,
      attachments: [{ filename, content: Buffer.from(pdf).toString("base64") }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function deliverReport(report: CostReport): Promise<Record<"discord" | "email", string>> {
  const payload = { report, pdf: await renderReportPdf(report), filename: reportFilename(report) };
  const [discord, email] = await Promise.allSettled([sendDiscord(payload), sendEmail(payload)]);
  const status = (s: PromiseSettledResult<void>) => (s.status === "fulfilled" ? "ok" : String(s.reason?.message ?? s.reason));
  return { discord: status(discord), email: status(email) };
}
