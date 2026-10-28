// 계절별 홈 순서 (10/28)
import assert from "node:assert/strict";
import { test } from "node:test";
import { seasonOf, seasonSort } from "@/lib/season-order";

test("계절 경계", () => {
  assert.equal(seasonOf("2026-10-19"), "autumn");
  assert.equal(seasonOf("2026-10-28"), "ski");
  assert.equal(seasonOf("2027-02-28"), "ski");
  assert.equal(seasonOf("2027-03-01"), "spring");
  assert.equal(seasonOf("2027-07-10"), "summer");
  assert.equal(seasonOf("2027-09-05"), "autumn");
});

test("올릴 것은 앞으로, 내릴 것은 뒤로, 고정은 그대로", () => {
  const ids = ["airport", "themepark", "waterpark", "ski", "indoor", "festival"];
  assert.deepEqual(seasonSort(ids, (x) => x, "ski", 1), ["airport", "ski", "themepark", "indoor", "festival", "waterpark"]);
  assert.deepEqual(seasonSort(ids, (x) => x, "summer", 1), ["airport", "waterpark", "themepark", "indoor", "festival", "ski"]);
  assert.deepEqual(seasonSort(ids, (x) => x, "autumn"), ["festival", "airport", "themepark", "indoor", "waterpark", "ski"]);
});
