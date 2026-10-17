// 메일 보내기 (Resend HTTP API). 다른 메일 서비스로 바꾸려면 이 파일만 고치면 된다.
// 실제 회원에게 보내려면 Resend에서 crowdview.app 도메인 인증 + MAIL_FROM(예: CrowdView <noreply@crowdview.app>) 설정이 필요하다
export const mailEnabled = !!process.env.RESEND_API_KEY;

/** 로그인 수단이 메일을 주지 않아 만든 주소 (예: kakao-123@users.crowdview.app)는 받을 수 없다 */
export const isDeliverable = (email?: string | null) => !!email && !/@users\.crowdview\.app$/i.test(email);

export async function sendMail(m: { to: string; subject: string; text: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY 미설정");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? process.env.REPORT_EMAIL_FROM ?? "CrowdView <onboarding@resend.dev>",
      to: [m.to],
      subject: m.subject,
      text: m.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
