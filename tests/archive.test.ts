// 자료 보관 (lib/archive): 객체 키는 KST 날짜 폴더, 줄에는 화면용 곡선을 빼고 실측만, 환경변수 없으면 아무것도 안 한다
import assert from "node:assert/strict";
import { test } from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import { archiveEnabled, archiveKey, archiveLines, archiveSnapshot } from "@/lib/archive";
import type { CrowdResult } from "@/lib/types";

const crowd: CrowdResult = {
  placeId: "everland",
  score: 55,
  open: true,
  headcount: 12000,
  trend: "flat",
  hourly: [{ hour: 10, score: 40, forecast: false }],
  source: "themeparks-wiki",
  zones: [{ id: "t-express", label: "T익스프레스", score: 80, waitMin: 90 }],
  avgWaitMin: 35,
  updatedAt: "2026-10-21T12:30:00.000Z",
  stale: false,
  ageMinutes: 3,
};
const seoul = {
  POI014: { area: "강남역", level: "보통", score: 48, min: 30000, max: 32000, time: "2026-10-21 21:05", forecast: [] },
};

test("객체 키: KST 날짜 폴더와 HHmm", () => {
  // 2026-10-21 12:35Z = 21:35 KST
  assert.equal(archiveKey(new Date("2026-10-21T12:35:00Z")), "archive/crowd/2026/10/21/2135.ndjson.gz");
  // 자정 넘김: 15:30Z = 다음 날 00:30 KST
  assert.equal(archiveKey(new Date("2026-10-21T15:30:00Z")), "archive/crowd/2026/10/22/0030.ndjson.gz");
});

test("줄: 장소는 hourly·stale·ageMinutes를 빼고, 서울은 코드를 붙인다. gzip 왕복", () => {
  const at = new Date("2026-10-21T12:35:00Z");
  const lines = archiveLines({ everland: crowd }, seoul, at);
  assert.equal(lines.length, 2);
  const p = JSON.parse(lines[0]);
  assert.equal(p.kind, "place");
  assert.equal(p.placeId, "everland");
  assert.equal(p.hourly, undefined);
  assert.equal(p.stale, undefined);
  assert.equal(p.zones[0].waitMin, 90);
  const s = JSON.parse(lines[1]);
  assert.equal(s.kind, "seoul");
  assert.equal(s.code, "POI014");
  assert.equal(s.min, 30000);
  const back = gunzipSync(gzipSync(Buffer.from(lines.join("\n")))).toString();
  assert.equal(back.split("\n").length, 2);
});

test("R2 환경변수가 없으면 꺼져 있고 저장 수 0", async () => {
  assert.equal(archiveEnabled(), false);
  assert.equal(await archiveSnapshot({ everland: crowd }, seoul), 0);
});
