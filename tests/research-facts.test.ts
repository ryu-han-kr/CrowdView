// 웹 조사 혼잡 정보 (lib/research-facts): 피크 시각은 실측 없는 곳·좁은 구간만
import assert from "node:assert/strict";
import { test } from "node:test";
import { researchPeak } from "@/lib/research-facts";
import type { Place } from "@/lib/types";

const base = { id: "x", hours: [10, 22], peakHour: 15 } as unknown as Place;

test("좁은 한 구간이면 그 가운데 (운영 시간 안으로 자름)", () => {
  assert.equal(researchPeak(base, { bh: [[18, 23]] }), 20);
  assert.equal(researchPeak(base, { bh: [[12, 16]] }), 14);
});

test("넓거나 여러 구간·실측 장소·운영 밖이면 쓰지 않는다", () => {
  assert.equal(researchPeak(base, { bh: [[10, 20]] }), undefined);
  assert.equal(researchPeak(base, { bh: [[12, 14], [18, 20]] }), undefined);
  assert.equal(researchPeak({ ...base, themeparksId: "t" } as Place, { bh: [[12, 16]] }), undefined);
  assert.equal(researchPeak(base, { bh: [[1, 4]] }), undefined);
  assert.equal(researchPeak(base, {}), undefined);
});
