// AI 여행 요약 답 읽기 (10/28)
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBrief } from "@/lib/trip-brief";
import { nearestStation } from "@/lib/subway";

test("JSON 답을 모양에 맞춰 읽고, 모르는 값은 기본값으로", () => {
  const text = `확인했어요.\n{"summary":"서울 대표 실내 테마파크","ticket":{"need":"paid","price":"어른 62,000원","where":"현장·공식 앱"},"transport":[{"mode":"subway","how":"2·8호선 잠실역 4번 출구"},{"mode":"rocket","how":"x"},{"mode":"bus","how":""}],"stay":"반나절","highlights":["매직아일랜드","아틀란티스",3],"tips":["평일 오전이 한산"],"plan":"석촌호수와 묶기"}`;
  const b = parseBrief(text, "2026-10-28")!;
  assert.equal(b.ticket.need, "paid");
  assert.deepEqual(
    b.transport.map((r) => r.mode),
    ["subway", "other"],
  );
  assert.deepEqual(b.highlights, ["매직아일랜드", "아틀란티스"]);
  assert.equal(b.source, "ai");
  assert.equal(parseBrief('{"ticket":{}}', "2026-10-28"), undefined);
  assert.equal(parseBrief("JSON 없음", "2026-10-28"), undefined);
  assert.equal(parseBrief('{"summary":"x","ticket":{"need":"maybe"}}', "d")!.ticket.need, "unknown");
});

test("가까운 지하철역: 잠실 롯데월드는 잠실역, 바다 한가운데는 없음", () => {
  const s = nearestStation({ lat: 37.5111, lng: 127.0982 });
  assert.ok(s && s.name.includes("잠실"), String(s?.name));
  assert.ok(s!.lines.length >= 1 && s!.walkMin >= 1);
  assert.equal(nearestStation({ lat: 35, lng: 125 }), null);
});
