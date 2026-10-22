// 요즘 뜨는 곳 (lib/trending · lib/ai-events): 검색어 이름 정리, AI 답 JSON 검사, 세부 분류
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAiEvents } from "@/lib/ai-events";
import { trendKeyword } from "@/lib/trending";
import { SUBS_OF, subOf } from "@/lib/subcategory";
import { PLACES } from "@/lib/places";

test("검색어: 회차·연도·괄호를 뗀다", () => {
  assert.equal(trendKeyword("제26회 한성백제문화제"), "한성백제문화제");
  assert.equal(trendKeyword("[서울시청] 2026 반짝반짝 남산"), "반짝반짝 남산");
  assert.equal(trendKeyword("에버랜드"), "에버랜드");
});

test("AI 답: 앞뒤 말이 있어도 JSON 배열만 꺼내고, 주소·이름 없는 항목과 틀린 날짜는 버린다", () => {
  const text = `찾아봤어요.\n[{"title":"에버랜드 할로윈","venue":"에버랜드","region":"경기","start":"2026-09-05","end":"2026-11-01","url":"https://www.everland.com","why":"시즌 이벤트"},
  {"title":"주소 없음","venue":"어딘가","region":"서울","start":"","end":"","url":"","why":""},
  {"title":"날짜 틀림","venue":"롯데월드","region":"서울","start":"10월 1일","end":"","url":"https://lotteworld.com","why":"x"}]`;
  const out = parseAiEvents(text);
  assert.equal(out.length, 2);
  assert.equal(out[0].title, "에버랜드 할로윈");
  assert.equal(out[1].start, "");
  assert.deepEqual(parseAiEvents("JSON이 없어요"), []);
  assert.deepEqual(parseAiEvents("[{깨진 json"), []);
});

test("세부 분류: 칩에 나오는 분류는 실제 장소가 있다", () => {
  for (const [cat, subs] of Object.entries(SUBS_OF)) {
    for (const s of subs!) assert.ok(PLACES.some((p) => p.category === cat && subOf(p.id) === s), `${cat}/${s}`);
  }
  assert.equal(subOf("aquaplanet-yeosu"), "aquarium");
  assert.equal(subOf("korean-folk-village"), "folk");
});
