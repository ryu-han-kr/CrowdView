// 운영 사이트 점검(스모크 테스트): 주요 화면이 열리고 핵심 내용이 보이는지, 코스 추천·상태 점검 API가 동작하는지.
// 사용: node scripts/smoke.mjs [기본 주소=https://crowdview.app]   (배포 후·매일 GitHub Actions smoke.yml)
const BASE = (process.argv[2] ?? "https://crowdview.app").replace(/\/$/, "");
const strip = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

const PAGES = [
  ["/", ["지금 어디가 한산할까"]],
  ["/map", ["혼잡도 지도"]],
  ["/explore", ["지역 여행"]],
  ["/guide", ["서울 여행 가이드"]],
  ["/route", ["한산한 코스"]],
  ["/seoul", ["서울 실시간"]],
  ["/seoul/POI008", ["경복궁"]],
  ["/place/gyeongbokgung", ["경복궁", "이번 주"]],
  ["/spot/haeundae", ["해운대", "이용 정보"]],
  ["/events", []],
  ["/airport", []],
  ["/methodology", []],
  ["/accuracy", []],
  ["/en", ["Where is it quiet"]],
  ["/sitemap.xml", ["<urlset"]],
  ["/llms.txt", ["CrowdView"]],
];

let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`✗ ${msg}`);
};

for (const [path, must] of PAGES) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
    const raw = await res.text();
    const text = path.endsWith(".xml") || path.endsWith(".txt") ? raw : strip(raw);
    const missing = must.filter((m) => !text.includes(m));
    if (res.status !== 200) fail(`${path} ${res.status}`);
    else if (missing.length) fail(`${path} 내용 없음: ${missing.join(", ")}`);
    else console.log(`✓ ${path} ${Date.now() - t0}ms`);
  } catch (e) {
    fail(`${path} ${e.message}`);
  }
}

// 가이드 상세 (예전 404 회귀 확인): 목록 데이터의 첫 장소
try {
  const rows = await (await fetch(`${BASE}/data/guide-ko.json`)).json();
  const res = await fetch(`${BASE}/guide/${rows[0][0]}`);
  res.status === 200 ? console.log(`✓ /guide/${rows[0][0]}`) : fail(`/guide/${rows[0][0]} ${res.status}`);
} catch (e) {
  fail(`guide detail ${e.message}`);
}

// 코스 추천 API
try {
  const res = await fetch(`${BASE}/api/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      start: { lat: 37.5665, lng: 126.978, name: "smoke" },
      interests: ["history", "shopping"],
      durationMin: 240,
      day: 1,
      hour: 10,
    }),
  });
  const j = await res.json();
  res.ok && j.plan?.stops?.length
    ? console.log(`✓ /api/route ${j.plan.stops.length}곳`)
    : fail(`/api/route ${res.status} ${JSON.stringify(j).slice(0, 120)}`);
} catch (e) {
  fail(`/api/route ${e.message}`);
}

// 상태 점검 (데이터 지연은 밤 공항 등 일시적일 수 있어 경고만)
try {
  const res = await fetch(`${BASE}/api/health`);
  const j = await res.json();
  if (!j.redis?.ok) fail("/api/health redis 실패");
  else console.log(`✓ /api/health ${res.status}${j.stale?.length ? ` (지연: ${j.stale.join(", ")})` : ""}`);
} catch (e) {
  fail(`/api/health ${e.message}`);
}

console.log(failed ? `\n${failed}개 실패` : "\n모두 통과");
process.exit(failed ? 1 : 0);
