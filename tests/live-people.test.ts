// '지금 실제 인원' 약 몇 명 (lib/live-count): ㎡당 인원 × 넓이, 보기 좋게 반올림
import assert from "node:assert/strict";
import { test } from "node:test";
import { roundPeople, withPeople } from "@/lib/live-count";

test("100 미만은 그대로, 1천 미만은 10명, 그 위는 100명 단위", () => {
  assert.equal(roundPeople(16.4), 16);
  assert.equal(roundPeople(434), 430);
  assert.equal(roundPeople(12_345), 12_300);
});

test("넓이를 모르는 곳·㎡당 값이 없으면 인원을 붙이지 않는다", () => {
  const base = { poiName: "x", level: 1 as const, score: 25, time: "" };
  assert.equal(withPeople("no-such-place", { ...base, density: 0.01 }).people, undefined);
  assert.equal(withPeople("gyeongbokgung", base).people, undefined);
});
