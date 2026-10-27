// 브라우저 오류 받기 (components/ErrorReporter). 하루 건수는 Redis에 세고, 내용은 운영 알림(디스코드, 같은 내용 10분 1번)
import { NextResponse } from "next/server";
import { kv } from "@/lib/cache";
import { opsAlert } from "@/lib/ops";
import { rateLimit } from "@/lib/ratelimit";
import { kst } from "@/lib/time";

// 우리 코드가 아닌 잡음 (확장 프로그램, 브라우저 내부 경고, 애드센스 내부 경고 — 10/27 광고 단위를 켜자 'No slot size'가 디스코드에 쏟아졌다)
const NOISE = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection|Load failed|NetworkError|Failed to fetch|adsbygoogle|TagError/i;

export async function POST(req: Request) {
  const limited = await rateLimit(req, "log");
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { message?: string; stack?: string; url?: string };
  const message = String(body.message ?? "").slice(0, 300);
  if (!message || NOISE.test(message) || NOISE.test(String(body.stack ?? ""))) return NextResponse.json({ ok: true, ignored: true });
  const today = await kv.incr(`clienterr:${kst().date}`, 8 * 86_400).catch(() => 0);
  // 하루 30건이 넘으면 세기만 한다 (누가 일부러 보내 운영 알림 채널을 도배하지 못하게)
  if (today > 30) return NextResponse.json({ ok: true, muted: true });
  await opsAlert(`브라우저 오류: ${message.slice(0, 120)}`, {
    url: String(body.url ?? "").slice(0, 200),
    stack: String(body.stack ?? "").slice(0, 800),
    ua: (req.headers.get("user-agent") ?? "").slice(0, 160),
  });
  return NextResponse.json({ ok: true });
}
