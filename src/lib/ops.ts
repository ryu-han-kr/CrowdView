// 운영 알림: 결제·웹훅·수집기에서 사람이 봐야 하는 일이 생기면 디스코드로 보낸다 (DISCORD_WEBHOOK_URL).
// 실패해도 본래 처리를 막지 않는다. 같은 내용은 10분에 한 번만 (폭주 방지, Redis)
import { kv } from "./cache";
import { shortHash } from "./cached";

const COOLDOWN_S = 600;

/**
 * opts.key: 같은 문제를 한 번만 알리기 위한 묶음 키 (기본은 제목+내용 — 내용에 분 같은 바뀌는 숫자가 있으면 key를 준다)
 * opts.cooldownS: 같은 키를 다시 알리기까지 (기본 10분)
 */
export async function opsAlert(title: string, detail?: unknown, opts: { key?: string; cooldownS?: number } = {}): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  const text = detail === undefined ? "" : detail instanceof Error ? detail.message : typeof detail === "string" ? detail : JSON.stringify(detail);
  console.warn(`[ops] ${title}`, text);
  if (!url) return;
  try {
    const key = `ops:${shortHash(opts.key ?? title + text)}`;
    if (await kv.get(key).catch(() => null)) return;
    await kv.set(key, "1", opts.cooldownS ?? COOLDOWN_S).catch(() => {});
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `🚨 **${title}**${text ? `\n\`\`\`${text.slice(0, 1500)}\`\`\`` : ""}` }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.warn("[ops] discord", e);
  }
}
