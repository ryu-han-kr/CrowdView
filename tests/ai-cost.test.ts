// Claude 비용 계산·비용 보고서 '왜 바뀌었나' 한 줄 (경수님 10/30: 비용이 왜 늘었는지 안 보였다)
import assert from "node:assert/strict";
import { test } from "node:test";
import { aiCostUsd } from "@/lib/ai-cost";
import { changeLine, type CostReport } from "@/lib/billing/report";

test("Claude 비용: 토큰 단가 + 웹 검색 1건 $0.01", () => {
  // Sonnet 5.5: 입력 100만 $2 + 출력 10만 $1 + 검색 3건 $0.03
  assert.equal(aiCostUsd("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 100_000, server_tool_use: { web_search_requests: 3 } }).toFixed(2), "3.03");
  // 캐시 읽기는 싸게, 표에 없는 모델은 Opus 값
  assert.equal(aiCostUsd("claude-haiku-5-5", { cache_read_input_tokens: 1_000_000 }).toFixed(2), "0.01");
  assert.equal(aiCostUsd("claude-unknown", { input_tokens: 1_000_000 }).toFixed(2), "4.00");
});

test("왜 바뀌었나: 월말 예상 증감 + 늘어난 항목만", () => {
  const r = { change: { projectedKrw: 3120, items: [{ name: "Claude API", krw: 1820 }, { name: "네이버 클라우드", krw: -50 }] } } as CostReport;
  assert.equal(changeLine(r), "어제 보고서보다 월말 예상 +3,120원 — 늘어난 곳: Claude API +1,820원");
  assert.equal(changeLine({} as CostReport), undefined);
});
