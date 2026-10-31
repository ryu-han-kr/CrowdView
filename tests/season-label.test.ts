import { test } from "node:test";
import assert from "node:assert/strict";
import { opensOf } from "../src/lib/crowd/model";
import { offSeasonLabel } from "../src/lib/season-label";
import { PLACES } from "../src/lib/places";
import { makeT } from "../src/i18n/translate";

const t = makeT(undefined);

test("비시즌 표시: 개장일이 없으면 여는 달, 발표된 날이 앞으로면 그 날짜", () => {
  const ski = PLACES.find((p) => p.id === "yongpyong")!;
  assert.equal(offSeasonLabel(opensOf(ski, "2026-11-01"), t), "12월 오픈 예정");
  assert.equal(offSeasonLabel(opensOf({ ...ski, openDate: "2026-11-28" }, "2026-11-01"), t), "11/28 오픈 예정");
  // 지난 개장일은 무시하고 여는 달로
  assert.equal(offSeasonLabel(opensOf({ ...ski, openDate: "2025-11-28" }, "2026-11-01"), t), "12월 오픈 예정");
  assert.equal(offSeasonLabel(undefined, t), "시즌 아님");
});
