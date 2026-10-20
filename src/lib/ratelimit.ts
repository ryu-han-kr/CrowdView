// 요청 수 제한 (IP별 1분 창, Redis INCR). 계산·번역 비용이 드는 API를 반복 호출로부터 보호한다.
// Redis가 안 되면 막지 않는다 (서비스를 멈추는 쪽보다 비용 위험이 작다)
import { NextResponse } from "next/server";
import { kv } from "./cache";

/** 버킷별 1분 허용 횟수 */
export const LIMITS = { route: 20, share: 10, alerts: 30, me: 60, log: 10, admin: 30, report: 6 } as const;
export type Bucket = keyof typeof LIMITS;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** 허용이면 null, 넘었으면 429 응답 (Retry-After 포함) */
export async function rateLimit(req: Request, bucket: Bucket): Promise<NextResponse | null> {
  const minute = Math.floor(Date.now() / 60_000);
  try {
    const n = await kv.incr(`rl:${bucket}:${clientIp(req)}:${minute}`, 70);
    if (n <= LIMITS[bucket]) return null;
  } catch {
    return null;
  }
  const retry = 60 - Math.floor((Date.now() / 1000) % 60);
  return NextResponse.json({ error: "요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요." }, { status: 429, headers: { "retry-after": String(retry) } });
}
