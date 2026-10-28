// Paddle 웹훅 서명 확인·패스 꺼내기 (10/28)
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { passOf, verifyPaddleSignature } from "@/lib/paddle";

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

test("결제 완료 알림에서 회원·일수, 모르는 가격은 없음", () => {
  assert.deepEqual(passOf({ id: "txn_1", status: "completed", custom_data: { userId: "u1" }, items: [{ price: { id: "pri_01m60881fypvhg2pryp2rm2j8q" } }] }), {
    userId: "u1",
    days: 30,
    priceId: "pri_01m60881fypvhg2pryp2rm2j8q",
  });
  assert.equal(passOf({ id: "txn_2", status: "completed", custom_data: { userId: "u1" }, items: [{ price: { id: "pri_x" } }] }), undefined);
  assert.equal(passOf({ id: "txn_3", status: "completed", items: [{ price: { id: "pri_01m608766sry3nhj5y6eck3q3b" } }] }), undefined);
});
