// 관광공사 운영 시간·휴무 글 나누기 (지인 QA 10/30: '연중무휴※ 기상상황에 따라 변동')
import assert from "node:assert/strict";
import { test } from "node:test";
import { splitInfoNote } from "@/lib/info-note";

test("휴무: ※ 뒤는 따로 안내 줄로", () => {
  assert.deepEqual(splitInfoNote("연중무휴※ 기상상황에 따라 변동"), { main: "연중무휴", notes: ["※ 기상상황에 따라 변동"] });
  assert.deepEqual(splitInfoNote("매주 월요일"), { main: "매주 월요일", notes: [] });
});

test("운영: 위에 보이는 오늘 시간과 같은 '- 10:00~18:00'만 비운다", () => {
  const text = "- 10:00~18:00※ 기상 상황에 따라 휴장 또는 조기 폐장할 수 있으므로 홈페이지 참조";
  assert.deepEqual(splitInfoNote(text, [10, 18]), { main: "", notes: ["※ 기상 상황에 따라 휴장 또는 조기 폐장할 수 있으므로 홈페이지 참조"] });
  // 시간이 다르거나 다른 내용이 섞이면 그대로 둔다
  assert.equal(splitInfoNote(text, [9.5, 18]).main, "- 10:00~18:00");
  assert.equal(splitInfoNote("하절기 09:00~18:00\n동절기 09:00~17:00", [9, 18]).main, "하절기 09:00~18:00\n동절기 09:00~17:00");
  assert.equal(splitInfoNote("09:30~18:00", [9.5, 18]).main, "");
});
