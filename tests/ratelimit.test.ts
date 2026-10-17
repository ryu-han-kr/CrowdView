// 요청 수 제한 (lib/ratelimit): 1분 창 안에서 한도까지 통과, 넘으면 429, IP마다 따로
import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMITS, rateLimit } from "@/lib/ratelimit";

const req = (ip: string) => new Request("https://crowdview.app/api/route", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

test("한도까지는 통과, 넘으면 429와 Retry-After", async () => {
  const ip = `203.0.113.${Math.floor(Math.random() * 200)}`;
  for (let i = 0; i < LIMITS.route; i++) assert.equal(await rateLimit(req(ip), "route"), null);
  const res = await rateLimit(req(ip), "route");
  assert.ok(res);
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get("retry-after")) > 0);
});

test("다른 IP는 따로 센다", async () => {
  assert.equal(await rateLimit(req("198.51.100.7"), "route"), null);
});
