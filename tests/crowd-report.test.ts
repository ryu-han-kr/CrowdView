import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../src/lib/crowd-report";

test("제보 요약: 평균 단계·줄 선 시간·마지막 시각", () => {
  const s = summarize([
    { level: 2, t: "2026-10-20T08:00:00Z" },
    { level: 4, waitMin: 30, t: "2026-10-20T08:10:00Z" },
    { level: 3, waitMin: 10, t: "2026-10-20T08:20:00Z" },
  ]);
  assert.equal(s.count, 3);
  assert.equal(s.avgLevel, 3);
  assert.equal(s.avgWait, 20);
  assert.equal(s.latest, "2026-10-20T08:20:00Z");
});

test("제보가 없으면 0건만", () => {
  assert.deepEqual(summarize([]), { count: 0 });
});
