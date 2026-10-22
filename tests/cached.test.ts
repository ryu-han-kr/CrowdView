// 외부 API 캐시 (lib/cached): 원본이 실패하면 5분 동안 모든 서버가 다시 부르지 않는다 (실패 표시를 Redis에 공유)
import assert from "node:assert/strict";
import { test } from "node:test";
import { cached } from "@/lib/cached";

test("받아 둔 데이터 없이 실패하면 다음 호출은 원본을 부르지 않고 바로 실패한다", async () => {
  let calls = 0;
  const load = async () => {
    calls++;
    throw new Error("timeout");
  };
  await assert.rejects(cached("t:fail-once", 60, load));
  await assert.rejects(cached("t:fail-once", 60, load));
  assert.equal(calls, 1);
});

test("성공한 값은 fresh 동안 원본을 다시 부르지 않는다", async () => {
  let calls = 0;
  const load = async () => ++calls;
  assert.equal(await cached("t:ok", 60, load), 1);
  assert.equal(await cached("t:ok", 60, load), 1);
  assert.equal(calls, 1);
});

// 10/22: 연속 실패는 5분 → 15분 → 1시간으로 늘려 다시 부르고, 빌드 중에는 묵은 값이 있으면 원본을 부르지 않는다
import { kv } from "@/lib/cache";
import { retryAfterMs } from "@/lib/cached";

test("연속 실패 간격: 5분 → 15분 → 1시간, 그 뒤로도 1시간", () => {
  assert.deepEqual([1, 2, 3, 4, 9].map((n) => retryAfterMs(n) / 60_000), [5, 15, 60, 60, 60]);
  assert.equal(retryAfterMs(0) / 60_000, 5);
});

test("실패하면 연속 실패 횟수를 남긴다", async () => {
  await assert.rejects(
    cached("t:failn", 60, async () => {
      throw new Error("timeout");
    }),
  );
  assert.equal(await kv.get("t:failn:failn"), "1");
});

test("빌드 중에는 묵은 값이 있으면 원본을 부르지 않는다", async () => {
  let calls = 0;
  const load = async () => ++calls;
  assert.equal(await cached("t:build", 0.001, load), 1);
  await new Promise((r) => setTimeout(r, 5));
  const before = process.env.NEXT_PHASE;
  process.env.NEXT_PHASE = "phase-production-build";
  try {
    assert.equal(await cached("t:build", 0.001, load), 1);
    assert.equal(calls, 1);
  } finally {
    if (before === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = before;
  }
  // 빌드가 아니면 묵은 값은 다시 받는다
  assert.equal(await cached("t:build", 0.001, load), 2);
});
