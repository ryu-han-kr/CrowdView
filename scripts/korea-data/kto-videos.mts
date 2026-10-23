// 관광공사 '관광 동영상'(대부분 2026 지역관광 드론 촬영)에서 우리 장소·명소 영상 모으기.
// 한국관광공사_관광 동영상 서비스(VideoService, data.go.kr 15162188) — 공공누리 제1유형(출처 표시). docs/관광공사-공모전·동영상-API-2026-10-23.md
//   결과: src/data/korea/kto-videos.json ({ [장소·명소 id]: [{ id, title, desc, thumb, hls, place, date }] }) — 상세 화면의 '드론 영상'
//   영상은 관광공사 CDN(HLS)에서 바로 재생한다. 우리 서버는 부르지 않는다 → 운영 중 API 호출 0
// 실행: npx tsx scripts/korea-data/kto-videos.mts   (DATA_GO_KR_KEY, 목록 2번 + 후보마다 상세 1번 ≈ 100번)
import fs from "node:fs";
import { LANDMARKS } from "../../src/lib/korea.ts";
import { PLACES } from "../../src/lib/places.ts";

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
const OUT = "src/data/korea/kto-videos.json";
const MAX = 3;
type Item = Record<string, string>;

// 시·도 짧은 이름 → 법정동 시도 코드 (2026: 전남·광주 통합 12, 예전 코드 29·46도 받는다)
const REGION_CODE: Record<string, string[]> = {
  서울: ["11"], 부산: ["26"], 대구: ["27"], 인천: ["28"], 광주: ["12", "29"], 대전: ["30"], 울산: ["31"], 세종: ["36"],
  경기: ["41"], 강원: ["51", "42"], 충북: ["43"], 충남: ["44"], 전북: ["52", "45"], 전남: ["12", "46"], 경북: ["47"], 경남: ["48"], 제주: ["50"],
};

async function call(op: string, params: Record<string, string>): Promise<Item[]> {
  const qs = new URLSearchParams({ serviceKey: KEY!, MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", ...params });
  const res = await fetch(`https://apis.data.go.kr/B551011/VideoService/${op}?${qs}`, { signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  if (/SERVICE_KEY_IS_NOT_REGISTERED|등록되지 않은/.test(text)) throw new Error("관광 동영상 활용신청이 안 된 키예요");
  const items = JSON.parse(text).response?.body?.items?.item;
  return Array.isArray(items) ? items : items ? [items] : [];
}

const norm = (s: string) => (s ?? "").replace(/\s+/g, "");
// 제목이 장소 이름을 담거나(부산 감천문화마을 ⊃ 감천문화마을), 장소 이름이 제목을 담을 때(경주 동궁과 월지 ⊃ 동궁과 월지)
const titleFits = (title: string, name: string) => {
  const t = norm(title);
  const n = norm(name);
  return n.length >= 2 && (t.includes(n) || (t.length >= 3 && n.includes(t)));
};

const all: Item[] = [];
for (let page = 1; ; page++) {
  const got = await call("videoList", { numOfRows: "1000", pageNo: String(page) });
  all.push(...got);
  if (got.length < 1000) break;
}
console.log(`영상 ${all.length}개`);

const targets = [
  ...PLACES.map((p) => ({ id: p.id, names: [p.name, ...((p as { aliases?: string[] }).aliases ?? [])], region: p.region.split(" ")[0] })),
  ...LANDMARKS.map((l) => ({ id: l.id, names: [l.n.ko], region: l.region })),
];

const out: Record<string, { id: string; title: string; titleEn: string; desc: string; descEn: string; thumb: string; hls: string; place: string; date: string }[]> = {};
for (const t of targets) {
  const codes = REGION_CODE[t.region];
  const cands = all.filter((v) => t.names.some((n) => titleFits(v.koTitle, n)) && (!codes || codes.includes(v.lDongRegnCd)));
  if (!cands.length) continue;
  const picked: (typeof out)[string] = [];
  for (const v of cands) {
    if (picked.length >= MAX) break;
    const [d] = await call("videoDetailInfo", { contentId: v.contentId });
    if (!d?.orgCdnUrl?.startsWith("https://") || !/\.m3u8$/.test(d.orgCdnUrl)) continue;
    // 같은 날 같은 곳을 여러 컷으로 올린 경우가 많다 → 설명이 겹치면 건너뛴다
    if (picked.some((p) => p.desc.slice(0, 30) === (d.koDescription ?? "").slice(0, 30))) continue;
    picked.push({
      id: v.contentId,
      title: d.koTitle,
      titleEn: d.enTitle ?? "",
      desc: (d.koDescription ?? "").trim(),
      descEn: (d.enDescription ?? "").trim(),
      thumb: d.thumbnailurl,
      hls: d.orgCdnUrl,
      place: d.koShtngPlace ?? "",
      date: d.shtngDate ?? "",
    });
  }
  if (picked.length) {
    out[t.id] = picked;
    console.log(`${t.id} ${t.names[0]}: ${picked.length}개 (후보 ${cands.length})`);
  }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(out).length}곳 → ${OUT}`);
