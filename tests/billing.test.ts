// 결제 규칙: 다음 달 같은 날(말일 보정), 포트원 웹훅 서명 확인, 자동결제 안내 문구, 메일 받을 수 있는 주소
import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeliverable } from "@/lib/mail";
import { addMonth, renewalText } from "@/lib/plus";
import { customerKeyOf } from "@/lib/toss";

test("다음 달 같은 날, 없는 날이면 그달 말일", () => {
  const next = (iso: string) => addMonth(new Date(iso)).toISOString().slice(0, 10);
  assert.equal(next("2026-01-31T03:00:00Z"), "2026-02-28");
  assert.equal(next("2026-03-15T03:00:00Z"), "2026-04-15");
  assert.equal(next("2026-12-31T03:00:00Z"), "2027-01-31");
});

test("토스 고객 키: 회원마다 같고, 회원 ID가 드러나지 않고, 토스 형식(2~50자 영문·숫자·-_=.@)에 맞다", () => {
  process.env.BETTER_AUTH_SECRET = "test-secret";
  const a = customerKeyOf("user-abc");
  assert.equal(customerKeyOf("user-abc"), a);
  assert.notEqual(customerKeyOf("user-abd"), a);
  assert.ok(!a.includes("user-abc"));
  assert.match(a, /^[A-Za-z0-9\-_=.@]{2,50}$/);
});

test("자동결제 안내에는 날짜·금액·해지 방법이 들어간다", () => {
  const text = renewalText("2026-11-17", "3,900");
  assert.match(text, /2026-11-17/);
  assert.match(text, /3,900원/);
  assert.match(text, /해지/);
});

test("카카오 로그인이 만든 가짜 주소에는 메일을 보내지 않는다", () => {
  assert.equal(isDeliverable("kakao-123@users.crowdview.app"), false);
  assert.equal(isDeliverable("me@example.com"), true);
  assert.equal(isDeliverable(null), false);
});
