// 리포트 발송: 디스코드 웹훅 + 이메일(Resend)
import { reportHtml, reportMarkdown, reportTitle, type CostReport } from "./report";

async function sendDiscord(r: CostReport): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) throw new Error("DISCORD_WEBHOOK_URL 미설정");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: reportMarkdown(r).slice(0, 2000) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`discord ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// 도메인 인증 전에는 onboarding@resend.dev 발신, Resend 가입 이메일로만 수신 가능
async function sendEmail(r: CostReport): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL_TO;
  if (!key || !to) throw new Error("RESEND_API_KEY / REPORT_EMAIL_TO 미설정");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.REPORT_EMAIL_FROM ?? "CrowdView <onboarding@resend.dev>",
      to: to.split(",").map((s) => s.trim()),
      subject: reportTitle(r),
      html: reportHtml(r),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function deliverReport(r: CostReport): Promise<Record<"discord" | "email", string>> {
  const [discord, email] = await Promise.allSettled([sendDiscord(r), sendEmail(r)]);
  const status = (s: PromiseSettledResult<void>) => (s.status === "fulfilled" ? "ok" : String(s.reason?.message ?? s.reason));
  return { discord: status(discord), email: status(email) };
}
