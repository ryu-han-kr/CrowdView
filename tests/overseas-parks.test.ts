// 해외 테마파크 대기시간 요약 (lib/overseas-parks, 10/30)
import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize } from "@/lib/overseas-parks";

const now = Date.parse("2026-10-30T10:00:00Z");
const ride = (name: string, wait: number | null, status = "OPERATING", lastUpdated = "2026-10-30T09:55:00Z") => ({
  name,
  entityType: "ATTRACTION",
  status,
  lastUpdated,
  queue: { STANDBY: { waitTime: wait } },
});

test("운영 중이고 대기시간이 있는 놀이기구만 평균, 상위 3개", () => {
  const s = summarize(
    [ride("A", 10), ride("B", 50), ride("C", 30), ride("D", 20), ride("E", null), ride("F", 90, "CLOSED"), { name: "Show", entityType: "SHOW", status: "OPERATING" }],
    now,
  );
  assert.equal(s.rides, 4);
  assert.equal(s.avgWait, 28);
  assert.deepEqual(s.top.map((x) => x.name), ["B", "C", "D"]);
  assert.equal(s.level?.label, "보통");
});

test("세 시간 넘게 갱신 없는 값은 버리고, 없으면 대기시간 정보 없음", () => {
  const s = summarize([ride("A", 40, "OPERATING", "2026-10-29T09:00:00Z")], now);
  assert.equal(s.rides, 0);
  assert.equal(s.avgWait, undefined);
});
