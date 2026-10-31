// 링크·혼잡 출처 감사 (11/1 지인 QA): 다른 자료끼리 이름·거리로 잇는 곳이 '같은 것'만 잇는지 실제 자료 전체로 확인한다.
// - 광안리해수욕장 카드 → 짱오락실 부산광안리점(오락실)이 열렸다
// - 해동용궁사 '지금 혼잡도'가 롯데월드 어드벤처 부산 값을 빌려 썼다
import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceKm } from "@/lib/geo";
import { LANDMARKS, REGIONS, festivalCrowdSource, landmarkCrowdSource, landmarkLink, type LandmarkKind } from "@/lib/korea";
import { landmarkCard } from "@/lib/korea-cards";
import { PLACES } from "@/lib/places";
import { sameSpotAsArea } from "@/lib/route-data";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { newsTitleFits, placeForEvent } from "@/lib/trending";
import type { Category, Place } from "@/lib/types";
import { makeT } from "@/i18n/translate";

// ── 구현과 따로 쓴 판정 (구현의 nameKey·KIND_CATEGORIES를 그대로 쓰면 같은 실수를 같이 통과한다)
/** 핵심 이름: 괄호·띄어쓰기·기호·영문·숫자와 일반 꼬리(해수욕장·공원·타워 등)를 뗀다. 괄호 안 이름도 따로 */
const cores = (name: string) =>
  [name, ...(name.match(/\((.*?)\)/g) ?? []).map((p) => p.slice(1, -1))]
    .map((n) =>
      n
        .replace(/\(.*?\)/g, "")
        .replace(/[\s·()\-,A-Za-z0-9]/g, "")
        .replace(/(해수욕장|해변|공원|타워|관광특구|일대|역)$/g, ""),
    )
    .filter((k) => k.length >= 2);
const nameRelation = (a: string, b: string): "same" | "part" | "none" => {
  let r: "same" | "part" | "none" = "none";
  for (const x of cores(a))
    for (const y of cores(b)) {
      if (x === y) return "same";
      if (x.includes(y) || y.includes(x)) r = "part";
    }
  return r;
};
/** 명소 종류마다 같은 곳일 수 있는 우리 장소 분류 */
const COMPATIBLE: Record<LandmarkKind, Category[]> = {
  history: ["landmark", "street"],
  nature: ["landmark", "street", "beach"],
  city: ["landmark", "street"],
  fun: ["themepark", "waterpark", "ski"],
  sea: ["beach"],
};
const NEVER: Category[] = ["indoor", "airport", "event"];
const placeById = (id: string) => PLACES.find((p) => p.id === id)!;

const t = makeT(undefined);
const card = (l: (typeof LANDMARKS)[number]) => landmarkCard(l, "ko", t, {}, {});

test("감사 대상이 실제 자료 전체다 (홈·지역 여행·근처 목록이 그리는 대표 명소)", () => {
  assert.ok(LANDMARKS.length >= 100, `대표 명소 ${LANDMARKS.length}곳`);
  // 지역 여행 화면은 REGIONS 지역별로 모든 명소를 그린다 → 빠지는 명소가 없어야 감사가 의미가 있다
  for (const l of LANDMARKS) assert.ok(REGIONS.some((r) => r.id === l.region), `${l.id} 지역 ${l.region}`);
  assert.ok(PLACES.some((p) => p.id === "zzang-gwangalli" && p.category === "indoor"));
});

test("모든 대표 명소 카드: 우리 장소로 가면 같은 이름·맞는 분류·가까운 곳, 실내·공항·행사로는 가지 않는다", () => {
  const bad: string[] = [];
  for (const l of LANDMARKS) {
    const c = card(l);
    const link = landmarkLink(l, "ko");
    assert.equal(c.href, link.href, `${l.id} 카드 주소`);
    if (link.placeId) {
      const p = placeById(link.placeId);
      const rel = nameRelation(p.name, l.n.ko);
      const km = distanceKm(p, l);
      if (NEVER.includes(p.category)) bad.push(`${l.n.ko} → ${p.name} (${p.category})`);
      else if (rel === "none") bad.push(`${l.n.ko} → ${p.name} (이름 다름)`);
      else if (rel === "part" && (!COMPATIBLE[l.kind].includes(p.category) || km >= 1.5)) bad.push(`${l.n.ko} → ${p.name} (${p.category}, ${km.toFixed(2)}km)`);
      else if (km >= 3) bad.push(`${l.n.ko} → ${p.name} (${km.toFixed(1)}km)`);
      assert.equal(c.href, `/place/${p.id}`);
    } else if (link.seoulCode) {
      const a = SEOUL_AREAS.find((x) => x.code === link.seoulCode)!;
      assert.equal(l.region, "서울", `${l.id}: 서울 밖 명소가 서울 지역으로`);
      const rel = a.name
        .split("·")
        .map((n) => nameRelation(n, l.n.ko))
        .reduce((x, y) => (x === "same" || y === "same" ? "same" : x === "part" || y === "part" ? "part" : "none"));
      if (rel === "none") bad.push(`${l.n.ko} → 서울 ${a.name} (이름 다름)`);
      if (distanceKm(a, l) >= 3) bad.push(`${l.n.ko} → 서울 ${a.name} (멀다)`);
    } else {
      assert.equal(link.href, `/spot/${l.id}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("광안리해수욕장 → 명소 상세 (짱오락실 아님), 해운대해수욕장 → 해운대 해수욕장 장소", () => {
  const gwangalli = LANDMARKS.find((l) => l.n.ko === "광안리해수욕장")!;
  assert.ok(gwangalli, "광안리해수욕장 명소가 있다");
  assert.equal(landmarkLink(gwangalli, "ko").href, `/spot/${gwangalli.id}`);
  assert.notEqual(card(gwangalli).href, "/place/zzang-gwangalli");
  const haeundae = LANDMARKS.find((l) => l.n.ko === "해운대해수욕장")!;
  assert.equal(landmarkLink(haeundae, "ko").placeId, "haeundae");
  // 이름이 같은 곳은 그대로 이어진다 (회귀 방지)
  const id = (ko: string) => landmarkLink(LANDMARKS.find((l) => l.n.ko === ko)!, "ko").placeId;
  assert.equal(id("경복궁"), "gyeongbokgung");
  assert.equal(id("에버랜드"), "everland");
  assert.equal(id("한국민속촌"), "korean-folk-village");
});

test("모든 대표 명소의 '가까운 측정 지점': 실내·공항·행사는 안 되고, 이름이 다르면 같은 종류·1km 안, 서울 지역은 0.8km 안", () => {
  const bad: string[] = [];
  for (const l of LANDMARKS) {
    const s = landmarkCrowdSource(l);
    if (s?.placeId) {
      const p = placeById(s.placeId);
      const rel = nameRelation(p.name, l.n.ko);
      const km = distanceKm(p, l);
      if (NEVER.includes(p.category)) bad.push(`${l.n.ko} ← ${p.name} (${p.category})`);
      else if (rel !== "same" && !COMPATIBLE[l.kind].includes(p.category)) bad.push(`${l.n.ko} ← ${p.name} (${p.category}, 종류 다름)`);
      else if (rel === "none" && km >= 1) bad.push(`${l.n.ko} ← ${p.name} (${km.toFixed(2)}km)`);
    } else if (s?.seoulCode) {
      const a = SEOUL_AREAS.find((x) => x.code === s.seoulCode)!;
      if (l.region !== "서울") bad.push(`${l.n.ko} ← 서울 ${a.name}`);
      const same = a.name.split("·").some((n) => nameRelation(n, l.n.ko) !== "none");
      if (!same && distanceKm(a, l) >= 0.8) bad.push(`${l.n.ko} ← 서울 ${a.name} (${distanceKm(a, l).toFixed(2)}km)`);
    }
  }
  assert.deepEqual(bad, []);
});

test("해동용궁사는 롯데월드 어드벤처 부산 혼잡을 빌리지 않는다 (가까운 곳이 없으면 빌리지 않음)", () => {
  const l = LANDMARKS.find((x) => x.n.ko === "해동용궁사")!;
  assert.ok(l, "해동용궁사 명소가 있다");
  assert.ok(distanceKm(placeById("lotteworld-busan"), l) < 1.5, "테마파크가 실제로 가까이 있다 (이 시험이 의미가 있게)");
  const s = landmarkCrowdSource(l);
  assert.notEqual(s?.placeId, "lotteworld-busan");
  assert.equal(s, undefined);
  // 지금 값이 있는 곳만 고르게 해도 마찬가지
  assert.equal(landmarkCrowdSource(l, { place: () => true, area: () => true }), undefined);
});

test("측정 지점: 같은 곳이 먼저, 값이 없는 곳은 건너뛴다", () => {
  const gyeongbok = LANDMARKS.find((x) => x.n.ko === "경복궁")!;
  assert.equal(landmarkCrowdSource(gyeongbok)?.placeId, "gyeongbokgung");
  // 경복궁 장소 값이 없으면 실내 장소가 아니라 서울 실시간 지역으로
  const s = landmarkCrowdSource(gyeongbok, { place: (id) => id !== "gyeongbokgung", area: () => true });
  assert.ok(s?.seoulCode, `경복궁 → ${JSON.stringify(s)}`);
  const bongeun = LANDMARKS.find((x) => x.n.ko === "봉은사")!;
  const b = landmarkCrowdSource(bongeun);
  assert.ok(!b?.placeId || !NEVER.includes(placeById(b.placeId).category), "봉은사가 오락실(펀시티 코엑스몰점) 값을 빌리지 않는다");
});

test("축제 혼잡 출처: 실내 매장·다른 테마파크는 빌리지 않고, 축제 이름에 든 우리 장소는 쓴다", () => {
  const arcade = placeById("zzang-gwangalli");
  const near = { lat: arcade.lat + 0.001, lng: arcade.lng, region: "부산 수영구" };
  const s = festivalCrowdSource({ ...near, title: "광안리 어방축제" });
  assert.ok(!s?.placeId || !NEVER.includes(placeById(s.placeId).category), JSON.stringify(s));
  const fireworks = placeById("busan-fireworks");
  assert.equal(festivalCrowdSource({ lat: fireworks.lat, lng: fireworks.lng, region: "부산 수영구", title: "제21회 부산불꽃축제" })?.placeId, "busan-fireworks");
  const ever = placeById("everland");
  assert.equal(festivalCrowdSource({ lat: ever.lat, lng: ever.lng, region: "경기 용인시", title: "에버랜드 튤립축제" })?.placeId, "everland");
  const lw = placeById("lotteworld-busan");
  assert.equal(festivalCrowdSource({ lat: lw.lat + 0.005, lng: lw.lng, region: "부산 기장군", title: "기장 멸치축제" }), undefined);
});

test("AI 화제 행사 → 우리 장소: 짧은 장소 이름·다른 지역·실내 매장으로 잘못 가지 않는다", () => {
  const ev = (title: string, venue: string, region: string) => placeForEvent({ title, venue, region })?.id;
  assert.notEqual(ev("광안리 드론쇼", "광안리해수욕장", "부산"), "zzang-gwangalli");
  assert.notEqual(ev("광안리 드론쇼", "광안리", "부산"), "zzang-gwangalli");
  assert.equal(ev("롯데월드 어드벤처 부산 할로윈", "롯데월드 어드벤처 부산", "부산"), "lotteworld-busan");
  assert.equal(ev("롯데월드 어드벤처 부산 할로윈", "기장", "부산광역시"), "lotteworld-busan");
  assert.equal(ev("롯데월드 핼러윈 축제", "롯데월드", "서울"), "lotteworld");
  assert.equal(ev("에버랜드 할로윈", "에버랜드", "경기"), "everland");
  assert.equal(ev("에버랜드 할로윈", "에버랜드", "경기도"), "everland");
  assert.equal(ev("부산불꽃축제", "광안리해수욕장", "부산"), "busan-fireworks");
  // 서울 행사가 부산 장소로 가지 않는다
  assert.equal(ev("서울 빛 축제", "광화문광장", "서울"), undefined);
  // 모든 실내 매장: 그 매장 이름이 장소 칸에 그대로 있을 때만 (제목·짧은 장소로는 안 감)
  for (const p of PLACES.filter((x) => x.category === "indoor")) {
    const short = p.name.split(" ").at(-1)!.replace(/점$/, "");
    // 이름이 한 낱말뿐인 곳(스파이더짐)은 장소 칸이 이름과 같으므로 이어지는 게 맞다
    if (short.length >= 2 && short !== p.name.replace(/\s/g, "")) assert.notEqual(ev(`${short} 축제`, short, p.region.split(" ")[0]), p.id, `${p.name} ← '${short}'`);
  }
});

test("장소 소식: 더 긴 이름의 다른 장소 기사는 짧은 이름 장소의 소식이 아니다", () => {
  const lw = placeById("lotteworld");
  assert.equal(newsTitleFits(lw, "롯데월드", "롯데월드 할로윈 퍼레이드 시작"), true);
  assert.equal(newsTitleFits(lw, "롯데월드", "롯데월드 어드벤처 부산 할로윈 시작"), false);
  assert.equal(newsTitleFits(lw, "롯데월드", "롯데월드 아쿠아리움 상어 먹이 주기"), false);
  const busan = placeById("lotteworld-busan");
  assert.equal(newsTitleFits(busan, "롯데월드 어드벤처 부산", "롯데월드 어드벤처 부산 할로윈 시작"), true);
  const gj = placeById("gyeongjuworld");
  assert.equal(newsTitleFits(gj, "경주월드", "경주월드 캘리포니아비치 개장"), false);
});

test("코스 후보: 서울 지역은 근처 실내 매장·행사 장소 때문에 빠지지 않는다", () => {
  const area = (name: string) => SEOUL_AREAS.find((a) => a.name === name)!;
  const drops = (name: string) => PLACES.filter((p: Place) => sameSpotAsArea(p, area(name))).map((p) => p.id);
  assert.deepEqual(drops("강남 MICE 관광특구"), []);
  assert.deepEqual(drops("이태원 관광특구"), []);
  assert.deepEqual(drops("여의도한강공원"), []);
  assert.ok(drops("경복궁").includes("gyeongbokgung"));
  assert.ok(drops("홍대 관광특구").includes("hongdae"));
  for (const a of SEOUL_AREAS)
    for (const p of PLACES) if (sameSpotAsArea(p, a)) assert.ok(!["indoor", "event"].includes(p.category), `${a.name} ← ${p.name}`);
});
