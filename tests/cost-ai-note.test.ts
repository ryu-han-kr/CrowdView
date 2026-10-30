// 비용 보고서 AI 한 줄 (lib/billing/ai-note): 어떤 API를 '튄 것'으로 보는지
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApiUsage } from "@/lib/api-quota";
import { findSpikes } from "@/lib/billing/ai-note";

const u = (id: string, count: number): ApiUsage => ({ id, name: id, count });

test("평소의 2배가 넘고 10 이상인 것만 튄 것으로 본다", () => {
  const before = Array.from({ length: 6 }, () => [u("brave", 20), u("anthropic", 3), u("papago", 0)]);
  const spikes = findSpikes([u("brave", 30), u("anthropic", 40), u("papago", 9)], before);
  assert.deepEqual(
    spikes.map((s) => s.name),
    ["anthropic"],
  );
  assert.equal(spikes[0].avg, 3);
});
