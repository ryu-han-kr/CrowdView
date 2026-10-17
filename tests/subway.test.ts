// 지하철 이동시간 (lib/subway): 실제 노선 기준으로 그럴듯한 범위인지
import assert from "node:assert/strict";
import { test } from "node:test";
import { subwayTrip } from "@/lib/subway";

const GYEONGBOKGUNG = { lat: 37.5796, lng: 126.977 };
const JAMSIL = { lat: 37.5112, lng: 127.0981 };
const HONGDAE = { lat: 37.5563, lng: 126.9236 };
const GANGNAM = { lat: 37.4979, lng: 127.0276 };

test("경복궁 → 잠실: 3호선 포함, 40~65분", () => {
  const t = subwayTrip(GYEONGBOKGUNG, JAMSIL);
  assert.ok(t);
  assert.ok(t.minutes >= 40 && t.minutes <= 65, `${t.minutes}분`);
  assert.ok(t.lines.includes("3호선"));
});

test("홍대 → 강남: 2호선 한 번에, 35~55분", () => {
  const t = subwayTrip(HONGDAE, GANGNAM);
  assert.ok(t);
  assert.deepEqual(t.lines, ["2호선"]);
  assert.ok(t.minutes >= 35 && t.minutes <= 55, `${t.minutes}분`);
});

test("근처에 역이 없으면 null", () => {
  assert.equal(subwayTrip({ lat: 37.2, lng: 128.5 }, GANGNAM), null);
});

test("GTX-A는 쓰지 않는다 (서울역~삼성 미개통)", () => {
  const t = subwayTrip({ lat: 37.5547, lng: 126.9707 }, { lat: 37.5088, lng: 127.0631 });
  assert.ok(t);
  assert.ok(!t.lines.some((l) => l.includes("GTX")));
});
