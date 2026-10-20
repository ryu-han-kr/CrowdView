// Plus 1개월 이용권 (lib/plus): 승인 전에 막아야 하는 것들 — 토스에 보내기 전에 거절돼야 한다 (DB·토스 없이 메모리 캐시로)
import assert from "node:assert/strict";
import { test } from "node:test";
import { PLUS } from "@/lib/business";
import { confirmPass, startPass } from "@/lib/plus";

test("남의 주문 번호로는 승인할 수 없다", async () => {
  const { orderId, amount } = await startPass("user-a");
  await assert.rejects(confirmPass("user-b", "pk_x", orderId, amount), /이 계정과 맞지 않아요/);
});

test("금액이 다르면 승인하지 않는다", async () => {
  const { orderId } = await startPass("user-a");
  await assert.rejects(confirmPass("user-a", "pk_x", orderId, PLUS.priceKrw - 1), /금액/);
});

test("주문 정보: 이용권 이름·금액·주문 번호 형식", async () => {
  const o = await startPass("user-c");
  assert.equal(o.amount, PLUS.priceKrw);
  assert.match(o.orderName, /1개월 이용권/);
  assert.match(o.orderId, /^pass_[A-Za-z0-9_-]{6,58}$/);
});
