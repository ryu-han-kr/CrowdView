// 로그인 없는 한 번 알림 (lib/alerts-anon): 브라우저 하나에 한 곳, 바꾸면 덮어쓰고, 끄면 사라진다 (메모리 kv)
import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteAnonAlert, getAnonAlert, saveAnonAlert } from "@/lib/alerts-anon";

const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } };

test("켜고·바꾸고·끈다", async () => {
  assert.equal(await getAnonAlert(sub.endpoint), null);
  await saveAnonAlert("everland", sub, "ko", 70);
  assert.equal(await getAnonAlert(sub.endpoint), "everland");
  await saveAnonAlert("lotteworld", sub, "ko", null);
  assert.equal(await getAnonAlert(sub.endpoint), "lotteworld");
  await deleteAnonAlert(sub.endpoint);
  assert.equal(await getAnonAlert(sub.endpoint), null);
});
