// 다가오는 연휴 묶음 (lib/holiday-windows): 주말과 붙은 쉬는 날 + 전날, 설·추석 대체공휴일 규칙
import assert from "node:assert/strict";
import { test } from "node:test";
import { upcomingHolidayWindows } from "@/lib/holiday-windows";

test("연말·설 연휴를 전날부터 묶는다", () => {
  const w = upcomingHolidayWindows("2026-10-31", 120);
  assert.deepEqual(
    w.map((x) => [x.name, x.days[0], x.days.at(-1)]),
    [
      ["크리스마스", "2026-12-24", "2026-12-27"],
      ["새해", "2026-12-31", "2027-01-03"],
      // 2027 설(2/7 일요일) → 2/9 대체공휴일
      ["설", "2027-02-05", "2027-02-09"],
    ],
  );
});

test("천문연구원 공휴일(임시공휴일 등)도 반영한다", () => {
  const w = upcomingHolidayWindows("2026-10-31", 30, new Map([["2026-11-18", "임시공휴일"]]));
  assert.deepEqual(w[0], { name: "공휴일", days: ["2026-11-17", "2026-11-18"] });
});
