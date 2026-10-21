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
