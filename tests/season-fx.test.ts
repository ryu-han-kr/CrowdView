// 홈 배경 효과: 눈·비가 오면 그대로, 아니면 계절 기본 (10/28)
import assert from "node:assert/strict";
import { test } from "node:test";
import { pickSeasonFx } from "@/lib/season-fx";

test("실제 눈·비가 계절보다 먼저", () => {
  assert.equal(pickSeasonFx(7, { pty: 3 }), "snow");
  assert.equal(pickSeasonFx(1, { pty: 1 }), "rain");
  assert.equal(pickSeasonFx(10, { pty: 4 }), "rain");
});

test("날씨 효과가 없으면 계절 기본", () => {
  assert.equal(pickSeasonFx(12, { pty: 0 }), "snow");
  assert.equal(pickSeasonFx(2), "snow");
  assert.equal(pickSeasonFx(4, { pty: 0 }), "sprout");
  assert.equal(pickSeasonFx(7, { pty: 0, pop: 20 }), "sun");
  assert.equal(pickSeasonFx(7, { pty: 0, pop: 70 }), "rain");
  assert.equal(pickSeasonFx(10, { pty: 0 }), "leaves");
});
