// 대표 명소 117곳 → 관광공사 데이터랩 시군구 코드 (src/data/korea/spot-region.json: { [명소 id]: { code, name } })
// 데이터랩 '지역별 방문자 수'(locgoRegnVisitrDDList)로 작년 같은 시기 그 시군구 방문객을 보려고. 주소의 시도·시군구 이름으로 맞춘다
// 실행: npx tsx scripts/korea-data/spot-region.mts  (호출 1건)
import fs from "node:fs";
import path from "node:path";

if (!process.env.DATA_GO_KR_KEY && fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) {
  console.error("DATA_GO_KR_KEY가 없어요");
  process.exit(1);
}

// 주소 첫 낱말 → 데이터랩 시군구 코드 앞 두 자리 (강원·전북은 특별자치도로 바뀌며 새 코드도 쓴다)
const SIDO: [RegExp, string[]][] = [
  // 2026년 통합: 전남광주통합특별시 — 데이터랩은 새 코드 12xxx (옛 광주 29·전남 46 대신)
  [/^전남광주/, ["12", "29", "46"]],
  [/^서울/, ["11"]],
  [/^부산/, ["26"]],
  [/^대구/, ["27"]],
  [/^인천/, ["28"]],
  [/^광주/, ["29"]],
  [/^대전/, ["30"]],
  [/^울산/, ["31"]],
  [/^세종/, ["36"]],
  [/^경기/, ["41"]],
  [/^강원/, ["42", "51"]],
  [/^충(청북|북)/, ["43"]],
  [/^충(청남|남)/, ["44"]],
  [/^전(라북|북)/, ["45", "52"]],
  [/^전(라남|남)/, ["46"]],
  [/^경(상북|북)/, ["47"]],
  [/^경(상남|남)/, ["48"]],
  [/^제주/, ["50"]],
];

// 한 날짜의 전국 시군구 목록 (코드·이름)
const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: "WEB", MobileApp: "CrowdView", _type: "json", numOfRows: "1000", pageNo: "1", startYmd: "20260901", endYmd: "20260901" });
const rows = ((await (await fetch(`https://apis.data.go.kr/B551011/DataLabService/locgoRegnVisitrDDList?${qs}`)).json()).response?.body?.items?.item ?? []) as {
  signguCode: string;
  signguNm: string;
}[];
const regions = [...new Map(rows.map((r) => [String(r.signguCode), String(r.signguNm)])).entries()];
console.log(`데이터랩 시군구 ${regions.length}곳`);

const landmarks = JSON.parse(fs.readFileSync(path.join("src", "data", "korea", "landmarks.json"), "utf8")) as { id: string; n: { ko: string } }[];
const info = JSON.parse(fs.readFileSync(path.join("src", "data", "korea", "landmark-info.json"), "utf8")) as Record<string, { addr?: string }>;
const out: Record<string, { code: string; name: string }> = {};
const missing: string[] = [];
for (const l of landmarks) {
  const words = (info[l.id]?.addr ?? "").split(/\s+/);
  const prefixes = SIDO.find(([re]) => re.test(words[0] ?? ""))?.[1];
  // 세종은 시군구가 하나, 나머지는 둘째 낱말(시·군·구) → 둘째+셋째(예: 창원시 의창구) → 셋째
  const candidates = words[0]?.startsWith("세종") ? ["세종시", "세종특별자치시"] : [words[1], `${words[1]} ${words[2]}`, words[2]].filter(Boolean);
  const hit = prefixes && regions.find(([code, name]) => prefixes.includes(code.slice(0, 2)) && candidates.includes(name));
  if (hit) out[l.id] = { code: hit[0], name: hit[1] };
  else missing.push(`${l.n.ko}(${words.slice(0, 3).join(" ")})`);
}
fs.writeFileSync(path.join("src", "data", "korea", "spot-region.json"), JSON.stringify(out));
console.log(`완료 ${Object.keys(out).length}/${landmarks.length}${missing.length ? ` · 못 맞춤: ${missing.join(", ")}` : ""}`);
