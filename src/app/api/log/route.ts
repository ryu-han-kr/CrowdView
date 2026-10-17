// 브라우저 오류 받기 (components/ErrorReporter). 하루 건수는 Redis에 세고, 내용은 운영 알림(디스코드, 같은 내용 10분 1번)
import { NextResponse } from "next/server";
import { kv } from "@/lib/cache";
import { opsAlert } from "@/lib/ops";
import { rateLimit } from "@/lib/ratelimit";
import { kst } from "@/lib/time";

// 우리 코드가 아닌 잡음 (확장 프로그램, 브라우저 내부 경고)
const NOISE = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection|Load failed|NetworkError|Failed to fetch/i;

export async function POST(req: Request) {
  const limited = await rateLimit(req, "log");
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { message?: string; stack?: string; url?: string };
  const message = String(body.message ?? "").slice(0, 300);
  if (!message || NOISE.test(message) || NOISE.test(String(body.stack ?? ""))) return NextResponse.json({ ok: true, ignored: true });
  await kv.incr(`clienterr:${kst().date}`, 8 * 86_400).catch(() => 0);
  await opsAlert(`브라우저 오류: ${message.slice(0, 120)}`, {
    url: String(body.url ?? "").slice(0, 200),
    stack: String(body.stack ?? "").slice(0, 800),
    ua: (req.headers.get("user-agent") ?? "").slice(0, 160),
  });
  return NextResponse.json({ ok: true });
}
