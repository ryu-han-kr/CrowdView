// 결제 규칙: 다음 달 같은 날(말일 보정), 포트원 웹훅 서명 확인, 자동결제 안내 문구, 메일 받을 수 있는 주소
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { isDeliverable } from "@/lib/mail";
import { addMonth, renewalText } from "@/lib/plus";
import { verifyWebhook } from "@/lib/portone";

test("다음 달 같은 날, 없는 날이면 그달 말일", () => {
  const next = (iso: string) => addMonth(new Date(iso)).toISOString().slice(0, 10);
  assert.equal(next("2026-01-31T03:00:00Z"), "2026-02-28");
  assert.equal(next("2026-03-15T03:00:00Z"), "2026-04-15");
  assert.equal(next("2026-12-31T03:00:00Z"), "2027-01-31");
});

test("웹훅 서명: 맞으면 통과, 본문이 바뀌거나 5분 넘게 지나면 거절", () => {
  const secret = Buffer.from("test-secret-key-123").toString("base64");
  process.env.PORTONE_WEBHOOK_SECRET = `whsec_${secret}`;
  const body = JSON.stringify({ type: "Transaction.Paid", data: { paymentId: "p1" } });
  const sign = (ts: string, b: string) => `v1,${createHmac("sha256", Buffer.from(secret, "base64")).update(`msg_1.${ts}.${b}`).digest("base64")}`;
  const headers = (sig: string, ts: string) => new Headers({ "webhook-id": "msg_1", "webhook-timestamp": ts, "webhook-signature": sig });
  const now = String(Math.floor(Date.now() / 1000));
  const old = String(Number(now) - 3600);
  assert.equal(verifyWebhook(body, headers(sign(now, body), now)), true);
  assert.equal(verifyWebhook(`${body} `, headers(sign(now, body), now)), false);
  assert.equal(verifyWebhook(body, headers(sign(old, body), old)), false);
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
