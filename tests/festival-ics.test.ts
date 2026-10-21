// 축제 캘린더 파일 (components/FestivalActions): 하루 종일 일정, 끝 날짜는 다음 날, 특수 문자 이스케이프
import assert from "node:assert/strict";
import { test } from "node:test";
import { festivalIcs } from "@/components/FestivalActions";

test("축제 기간이 하루 종일 일정으로 들어간다", () => {
  const ics = festivalIcs({
    id: "123",
    title: "불꽃축제, 2026",
    start: "2026-10-30",
    end: "2026-11-01",
    place: "여의도",
    url: "https://crowdview.app/festival/123",
  });
  assert.match(ics, /DTSTART;VALUE=DATE:20261030/);
  assert.match(ics, /DTEND;VALUE=DATE:20261102/);
  assert.ok(ics.includes(String.raw`SUMMARY:불꽃축제\, 2026`));
  assert.match(ics, /LOCATION:여의도/);
});
