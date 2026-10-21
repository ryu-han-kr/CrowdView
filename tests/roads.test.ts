// 가는 길 도로 상황 (10/21): 서울 지역 고르기, 도로공사 콘존 묶기·장소 근처 고르기
import assert from "node:assert/strict";
import { test } from "node:test";
import { conzonesFrom, conzonesNear, icKey, nearestSeoulArea, summarize } from "@/lib/roads";

test("서울 실시간 지역: 1.5km 안 가장 가까운 지역, 서울 밖은 없음", () => {
  assert.equal(nearestSeoulArea({ lat: 37.5111, lng: 127.098 }), "잠실역"); // 롯데월드 앞
  assert.equal(nearestSeoulArea({ lat: 35.1587, lng: 129.1604 }), undefined); // 해운대
});

test("나들목 이름: IC·괄호·띄어쓰기를 빼고 비교, 분기점(JC)은 맞추지 않는다", () => {
  assert.equal(icKey("구서IC"), "구서");
  assert.equal(icKey("판교JC"), undefined);
  assert.equal(icKey("서울 요금소"), "서울");
  assert.equal(icKey("기흥(동탄)IC"), "기흥");
});

test("콘존: 검지기 줄을 콘존별 평균 속도로, 속도 0은 뺀다", () => {
  const z = conzonesFrom([
    { routeName: "경부선", conzoneId: "A", conzoneName: "판교IC-서울TG", speed: "80" },
    { routeName: "경부선", conzoneId: "A", conzoneName: "판교IC-서울TG", speed: "60" },
    { routeName: "경부선", conzoneId: "A", conzoneName: "판교IC-서울TG", speed: "0" },
    { routeName: "경부선", conzoneId: "B", conzoneName: "구서IC-영락IC", speed: "" },
  ]);
  assert.deepEqual(z, [{ route: "경부선", name: "판교IC-서울TG", speed: 70 }]);
});

test("콘존: 한쪽 끝 나들목이라도 장소 8km 안이면 넣는다", () => {
  const units = [
    { name: "판교", lat: 37.3964, lng: 127.1032 },
    { name: "구서", lat: 35.25, lng: 129.09 },
  ];
  const zones = [
    { route: "경부선", name: "판교IC-신갈JC", speed: 30 },
    { route: "경부선", name: "구서IC-영락IC", speed: 90 },
    { route: "모름", name: "없는IC-모르는IC", speed: 90 },
  ];
  const near = conzonesNear(units, zones, { lat: 37.41, lng: 127.12 });
  assert.deepEqual(
    near.map((z) => z.name),
    ["판교IC-신갈JC"],
  );
});

test("요약: 출처가 따라가고, 고속도로는 시속 40 아래가 정체", () => {
  const g = summarize(
    [30, 35, 38, 90].map((speed, i) => ({ roadName: `경부선 ${i}`, speed })),
    "highway",
    "ex",
  );
  assert.equal(g?.source, "ex");
  assert.equal(g?.level, "정체");
  assert.equal(g?.slowest.length, 3);
});

test("콘존: 같은 이름 영업소가 여러 노선에 있으면 같은 노선 것을 쓰고, 분기점 끝은 맞추지 않는다", () => {
  const units = [
    { name: "용인", route: "영동선", lat: 37.27, lng: 127.22 },
    { name: "용인", route: "다른선", lat: 36.5, lng: 127.5 },
  ];
  const zones = [
    { route: "영동선", name: "용인IC-양지IC", speed: 80 },
    { route: "세종포천선", name: "용인JC-북용인JC", speed: 98 },
  ];
  assert.deepEqual(
    conzonesNear(units, zones, { lat: 37.2939, lng: 127.2025 }).map((z) => z.name),
    ["용인IC-양지IC"],
  );
});
