// 한국 기념일 고르기: 음력 명절 연휴 사흘·고정 기념일·기간 (10/28)
import assert from "node:assert/strict";
import { test } from "node:test";
import { krDayOn } from "@/lib/kr-days";

test("음력 명절은 전날·당일·다음날", () => {
  assert.equal(krDayOn("2027-02-06")?.id, "seollal");
  assert.equal(krDayOn("2027-02-08")?.id, "seollal");
  assert.equal(krDayOn("2027-02-09"), undefined);
  assert.equal(krDayOn("2026-09-25")?.id, "chuseok");
  // 2028 추석이 개천절과 겹치면 추석
  assert.equal(krDayOn("2028-10-03")?.id, "chuseok");
});

test("고정 기념일과 기간", () => {
  assert.equal(krDayOn("2026-12-31")?.id, "newyear");
  assert.equal(krDayOn("2027-01-02")?.id, "newyear");
  assert.equal(krDayOn("2027-01-03"), undefined);
  assert.equal(krDayOn("2027-03-01")?.id, "samiljeol");
  assert.equal(krDayOn("2027-05-04")?.id, "children");
  assert.equal(krDayOn("2027-08-15")?.id, "liberation");
  assert.equal(krDayOn("2026-10-09")?.id, "hangeul");
  assert.equal(krDayOn("2026-12-20")?.id, "christmas");
  assert.equal(krDayOn("2026-12-26"), undefined);
  assert.equal(krDayOn("2026-10-28"), undefined);
});
