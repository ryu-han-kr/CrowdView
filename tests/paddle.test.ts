// Paddle 웹훅 서명 확인·패스 꺼내기 (10/28)
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { passOf, verifyPaddleSignature } from "@/lib/paddle";
import { PASSES } from "@/lib/passes";
import { asPlan, planRank, PLANS } from "@/lib/business";

test("서명이 맞고 5분 안이면 통과, 틀리거나 오래되면 거절", () => {
  const secret = "pdl_ntfset_test";
  const raw = '{"event_type":"transaction.completed"}';
  const ts = 1_800_000_000;
  const h1 = crypto.createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex");
  assert.equal(verifyPaddleSignature(raw, `ts=${ts};h1=${h1}`, secret, ts * 1000), true);
  assert.equal(verifyPaddleSignature(raw + " ", `ts=${ts};h1=${h1}`, secret, ts * 1000), false);
  assert.equal(verifyPaddleSignature(raw, `ts=${ts};h1=${h1}`, secret, (ts + 600) * 1000), false);
  assert.equal(verifyPaddleSignature(raw, null, secret), false);
});

test("결제 완료 알림에서 회원·단계·일수, 모르는 가격은 없음", () => {
  // 예전 Pro 30일($6.99) 가격도 Pro 30일로
  assert.deepEqual(passOf({ id: "txn_1", status: "completed", custom_data: { userId: "u1" }, items: [{ price: { id: "pri_01m60881fypvhg2pryp2rm2j8q" } }] }), {
    userId: "u1",
    plan: "pro",
    days: 30,
    priceId: "pri_01m60881fypvhg2pryp2rm2j8q",
  });
  assert.equal(passOf({ id: "txn_2", status: "completed", custom_data: { userId: "u1" }, items: [{ price: { id: "pri_x" } }] }), undefined);
  assert.equal(passOf({ id: "txn_3", status: "completed", items: [{ price: { id: "pri_01m608766sry3nhj5y6eck3q3b" } }] }), undefined);
});

test("여행 패스: 세 등급 × 7일·30일, 가격 id는 겹치지 않고 위 등급일수록 비싸다", () => {
  assert.equal(PASSES.length, 6);
  assert.equal(new Set(PASSES.map((p) => p.priceId)).size, 6);
  for (const days of [7, 30]) {
    const usd = (["plus", "pro", "max"] as const).map((plan) => Number(PASSES.find((p) => p.plan === plan && p.days === days)!.usd.slice(1)));
    assert.ok(usd[0] < usd[1] && usd[1] < usd[2], `${days}일`);
  }
  const max30 = PASSES.find((p) => p.plan === "max" && p.days === 30)!;
  assert.deepEqual(passOf({ id: "txn_4", status: "completed", custom_data: { userId: "u2" }, items: [{ price_id: max30.priceId }] }), {
    userId: "u2",
    plan: "max",
    days: 30,
    priceId: max30.priceId,
  });
});

test("단계: 모르는 값은 plus, plus < pro < max, 위 단계일수록 횟수가 많다", () => {
  assert.equal(asPlan("max"), "max");
  assert.equal(asPlan("gold"), "plus");
  assert.equal(asPlan(undefined), "plus");
  assert.ok(planRank("plus") < planRank("pro") && planRank("pro") < planRank("max"));
  assert.ok(PLANS.plus.liveMonthly < PLANS.pro.liveMonthly && PLANS.pro.liveMonthly < PLANS.max.liveMonthly);
  // SK 33원 × 월 횟수가 월 요금의 35%를 넘지 않게
  for (const P of Object.values(PLANS)) assert.ok(P.liveMonthly * 33 <= P.priceKrw * 0.35, P.id);
});
