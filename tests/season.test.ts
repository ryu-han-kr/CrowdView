// 계절 영업 장소 (스키장·야외 워터파크): 시즌이 아닌 달에는 운영 종료 + 시즌 아님 표시
import assert from "node:assert/strict";
import { test } from "node:test";
import { inSeason, modelSnapshot } from "@/lib/crowd/model";
import { getPlace } from "@/lib/places";

test("해를 넘기는 시즌(12~3월)과 여름 시즌(6~8월)", () => {
  const ski = getPlace("yongpyong")!;
  assert.equal(inSeason(ski, "2026-12-01"), true);
  assert.equal(inSeason(ski, "2027-02-15"), true);
  assert.equal(inSeason(ski, "2026-03-31"), true);
  assert.equal(inSeason(ski, "2026-07-10"), false);
  const beach = getPlace("california-beach")!;
  assert.equal(inSeason(beach, "2026-07-10"), true);
  assert.equal(inSeason(beach, "2026-10-19"), false);
  assert.equal(inSeason(getPlace("everland")!, "2026-10-19"), true);
});

test("시즌이 아니면 운영 시간이어도 닫힘", () => {
  // 2026-07-10 13:00 KST
  const off = modelSnapshot(getPlace("yongpyong")!, new Date("2026-07-10T04:00:00Z"));
  assert.equal(off.open, false);
  assert.equal(off.offSeason, true);
  const on = modelSnapshot(getPlace("yongpyong")!, new Date("2027-01-09T04:00:00Z"));
  assert.equal(on.open, true);
  assert.equal(on.offSeason, undefined);
});
