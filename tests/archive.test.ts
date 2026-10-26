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

// 하루 요약 (lib/archive-summary): 깨진 줄은 버리고, 장소 평균은 문 연 것만, 최대 시각은 KST, 서울 사람 수는 범위 가운데
import { formatSummaryTable, parseArchiveLines, summarizeArchive } from "@/lib/archive-summary";

test("요약: 장소는 문 연 스냅샷만 평균, 최대 시각 KST, 서울은 범위 가운데 값", () => {
  const text = [
    JSON.stringify({ kind: "place", at: "2026-10-22T01:00:00.000Z", placeId: "everland", score: 0, open: false }),
    JSON.stringify({ kind: "place", at: "2026-10-22T03:00:00.000Z", placeId: "everland", score: 40, open: true, headcount: 10000 }),
    JSON.stringify({ kind: "place", at: "2026-10-22T05:00:00.000Z", placeId: "everland", score: 80, open: true, headcount: 20000 }),
    JSON.stringify({ kind: "seoul", at: "2026-10-22T03:00:00.000Z", code: "POI014", area: "강남역", score: 48, min: 30000, max: 32000 }),
    JSON.stringify({ kind: "seoul", at: "2026-10-22T05:00:00.000Z", code: "POI014", area: "강남역", score: 60, min: 40000, max: 44000 }),
    "",
    "{깨진 줄",
    JSON.stringify({ kind: "other", at: "x" }),
  ].join("\n");
  const lines = parseArchiveLines(text);
  assert.equal(lines.length, 5);
  const s = summarizeArchive(lines);
  assert.equal(s.snapshots, 3);
  assert.equal(s.from, "2026-10-22T01:00:00.000Z");
  assert.equal(s.to, "2026-10-22T05:00:00.000Z");
  const ev = s.places[0];
  assert.equal(ev.id, "everland");
  assert.deepEqual([ev.n, ev.openN, ev.avg, ev.max, ev.maxAt], [3, 2, 60, 80, "14:00"]);
  assert.deepEqual(ev.people, { avg: 15000, max: 20000 });
  const gn = s.seoul[0];
  assert.deepEqual([gn.label, gn.n, gn.avg, gn.max, gn.maxAt], ["강남역", 2, 54, 60, "14:00"]);
  assert.deepEqual(gn.people, { avg: 36500, max: 42000 });
  const table = formatSummaryTable(s.places);
  assert.match(table, /everland\s+2\/3\s+60\s+80\s+14:00\s+15,000\s+20,000/);
});

test("요약: 빈 입력", () => {
  const s = summarizeArchive([]);
  assert.deepEqual(s, { snapshots: 0, places: [], seoul: [] });
});

test("시간대별 평균: KST 시간으로 묶고, 문 닫은 장소 스냅샷은 빼고, 없는 시간은 -1", async () => {
  const { hourlyScores } = await import("@/lib/archive-summary");
  const m = hourlyScores([
    { kind: "place", at: "2026-10-25T01:00:00Z", placeId: "everland", score: 40 }, // 10시 KST
    { kind: "place", at: "2026-10-25T01:30:00Z", placeId: "everland", score: 60 },
    { kind: "place", at: "2026-10-25T14:00:00Z", placeId: "everland", score: 0, open: false }, // 23시, 문 닫음
    { kind: "seoul", at: "2026-10-25T15:10:00Z", code: "POI001", area: "강남", score: 33, min: 1, max: 2 }, // 0시 KST
  ]);
  const ev = m.get("place:everland")!;
  assert.equal(ev[10], 50);
  assert.equal(ev[23], -1);
  assert.equal(ev.filter((v) => v >= 0).length, 1);
  assert.equal(m.get("seoul:POI001")![0], 33);
});
