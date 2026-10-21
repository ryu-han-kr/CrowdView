// Queue-Times 예비 원천 (lib/crowd/themeparks): 운영 중 0분은 값 없음, 오래된 값은 버림
import assert from "node:assert/strict";
import { test } from "node:test";
import { liveQueueTimes } from "@/lib/crowd/themeparks";
import { PLACES } from "@/lib/places";

const everland = PLACES.find((p) => p.id === "everland")!;
const now = new Date().toISOString();
const old = new Date(Date.now() - 5 * 3600_000).toISOString();

test("에버랜드에 Queue-Times 번호가 있다", () => {
  assert.equal(everland.queueTimesId, 125);
});

test("운영 중 0분·닫힌 놀이기구·오래된 값은 대기시간에서 빠진다", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        lands: [{ name: "매직랜드", rides: [{ name: "A", is_open: true, wait_time: 30, last_updated: now }] }],
        rides: [
          { name: "B", is_open: true, wait_time: 0, last_updated: now },
          { name: "C", is_open: false, wait_time: 40, last_updated: now },
          { name: "D", is_open: true, wait_time: 50, last_updated: old },
        ],
      }),
    )) as typeof fetch;
  try {
    const live = await liveQueueTimes(everland);
    assert.equal(live.source, "queue-times");
    assert.equal(live.operating, 2);
    assert.deepEqual(live.rides, [{ name: "A", wait: 30, area: "매직랜드" }]);
  } finally {
    globalThis.fetch = orig;
  }
});
