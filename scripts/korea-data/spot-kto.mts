// 대표 명소 117곳 → 한국관광공사 '관광지 집중률 예측'(TatsCnctrRateService)에 등록된 이름 찾기
//   → src/data/korea/spot-kto.json ({ [명소 id]: { areaCd, signguCd, name } })
// 명소 상세에 '앞으로 30일 붐빔 예측' 그래프를 그리려고. 그 시군구의 관광지 목록에서 이름이 맞는 곳을 고른다 (없으면 빠짐)
// 우리 장소 중 kto가 없는 곳(지방 놀이공원·워터파크·스키장 등)도 같은 방법으로 → src/data/korea/place-kto.json (예측 모델의 집중률 보정에 쓴다)
// 실행: npx tsx scripts/korea-data/spot-kto.mts  (호출 약 180건)
import fs from "node:fs";
import path from "node:path";
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

type Item = Record<string, string>;
async function call(svc: string, op: string, params: Record<string, string>): Promise<Item[]> {
  const qs = new URLSearchParams({ serviceKey: KEY!, MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", pageNo: "1", ...params });
  try {
    const res = await fetch(`https://apis.data.go.kr/B551011/${svc}/${op}?${qs}`, { signal: AbortSignal.timeout(20_000) });
    const items = (await res.json()).response?.body?.items?.item;
    return Array.isArray(items) ? items : items ? [items] : [];
  } catch {
    return [];
  }
}

// 비교용: 괄호·띄어쓰기·지역 접두어 빼기 (예: "경주 불국사 [유네스코 세계유산]" → "불국사")
const norm = (s: string) => s.replace(/\[.*?\]|\(.*?\)|\s|·/g, "");
// 관광공사 집중률 목록에서 쓰는 이름이 다른 곳
const ALIAS: Record<string, string[]> = {
  "namsan-tower": ["N서울타워", "남산서울타워", "남산공원"],
  "lotte-tower": ["롯데월드타워", "서울스카이"],
  ddp: ["동대문디자인플라자", "DDP"],
  "e-world": ["이월드"],
  "kim-kwangseok-street": ["김광석다시그리기길", "김광석길"],
  "expo-park": ["엑스포과학공원", "한빛탑"],
  hwaseong: ["수원화성", "화성행궁"],
  imjingak: ["임진각", "평화누리"],
  seoraksan: ["설악산"],
  mudeungsan: ["무등산"],
  naejangsan: ["내장산"],
  hallasan: ["한라산"],
  beopjusa: ["법주사", "속리산"],
  "boseong-tea": ["대한다원", "보성녹차밭"],
  "windy-hill": ["바람의언덕"],
  "german-village": ["독일마을"],
  "gunsan-time": ["시간여행마을", "근대역사박물관"],
  "donggung-wolji": ["동궁과월지", "동궁과 월지"],
  // 2026-10-20 빈칸 채우기: 관광공사 집중률 목록의 이름
  wolmido: ["월미도"],
  "sejong-arboretum": ["국립세종수목원"],
  "sejong-lake": ["세종호수공원 일원", "세종호수공원"],
  gyeongpo: ["강릉 경포해수욕장", "경포해수욕장"],
  gungnamji: ["서동공원과 궁남지"],
  taehwagang: ["태화강국가정원", "태화강 국가정원", "태화강"],
  hallasan: ["한라산국립공원", "한라산", "1100고지습지"],
  hyeopjae: ["협재해수욕장", "협재"],
  // 같은 단지 안이라 그 단지의 집중률로 대신하는 곳 (데이터 점검 문서에 표시)
  ddp: ["동대문역사문화공원"],
  "busan-fireworks": ["광안리해수욕장"],
  "lantern-festival": ["청계광장"],
  "caribbean-bay": ["에버랜드"],
  "california-beach": ["경주월드 어뮤즈먼트"],
  yongpyong: ["모나용평"],
  high1: ["하이원리조트"],
  phoenix: ["휘닉스 평창"],
  konjiam: ["곤지암리조트"],
  muju: ["무주덕유산리조트 스키장"],
  "welli-hilli": ["웰리힐리파크 스노우파크"],
  oakvalley: ["오크밸리스키장"],
  alpensia: ["알펜시아 리조트"],
};
// 관광공사 콘텐츠의 법정동 코드가 이 API의 시군구 코드와 다른 곳 (인천 중구, 세종, 울산 중구, 제주)
const CODE: Record<string, { areaCd: string; signguCd: string }> = {
  wolmido: { areaCd: "28", signguCd: "28110" },
  "sejong-arboretum": { areaCd: "36", signguCd: "36110" },
  "sejong-lake": { areaCd: "36", signguCd: "36110" },
  taehwagang: { areaCd: "31", signguCd: "31110" },
};

const placeTargets = PLACES.filter((p) => !p.kto && p.ktoContent && p.category !== "airport").map((p) => ({
  id: p.id,
  cid: String(p.ktoContent!.id),
  n: { ko: p.name },
}));
const landmarks = JSON.parse(fs.readFileSync(path.join("src", "data", "korea", "landmarks.json"), "utf8")) as {
  id: string;
  cid: string;
  n: { ko: string };
}[];
const listCache = new Map<string, string[]>();
async function match(targets: typeof landmarks, file: string) {
const out: Record<string, { areaCd: string; signguCd: string; name: string }> = {};
const missing: string[] = [];
for (const l of targets) {
  let areaCd: string, signguCd: string;
  if (CODE[l.id]) ({ areaCd, signguCd } = CODE[l.id]);
  else {
    const [c] = await call("KorService2", "detailCommon2", { contentId: l.cid });
    if (!c?.lDongRegnCd) {
      missing.push(`${l.n.ko}(코드 없음)`);
      continue;
    }
    areaCd = c.lDongRegnCd;
    signguCd = `${c.lDongRegnCd}${c.lDongSignguCd}`;
  }
  if (!listCache.has(signguCd)) {
    const rows = await call("TatsCnctrRateService", "tatsCnctrRatedList", { areaCd, signguCd, numOfRows: "5000" });
    listCache.set(signguCd, [...new Set(rows.map((r) => r.tAtsNm))]);
  }
  // 숙소·휴양림은 이름이 겹쳐도 다른 곳 (예: 설악산 → 더케이설악산 가족호텔, 속리산 → 말티재자연휴양림)
  const names = listCache.get(signguCd)!.filter((n) => !/호텔|콘도|펜션|휴양림/.test(n) || /휴양림/.test(l.n.ko));
  const wants = [l.n.ko, ...(ALIAS[l.id] ?? [])].map(norm);
  // 정확히 같은 이름 → 서로 포함 (짧은 쪽이 3글자 이상)
  const hit =
    names.find((n) => wants.includes(norm(n))) ??
    names.find((n) => wants.some((w) => Math.min(w.length, norm(n).length) >= 3 && (norm(n).includes(w) || w.includes(norm(n)))));
  if (hit) {
    out[l.id] = { areaCd, signguCd, name: hit };
    console.log(`${l.n.ko} → ${hit}`);
  } else missing.push(l.n.ko);
}
// 장소 쪽은 이미 이어진 곳(kto 있음)을 다시 찾지 않으므로 지난 결과에 더한다
const target = path.join("src", "data", "korea", file);
const prev = (file === "place-kto.json" || process.env.ONLY_NEW) && fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : {};
fs.writeFileSync(target, JSON.stringify({ ...prev, ...out }));
console.log(`${file} 완료 ${Object.keys(out).length}/${targets.length} · 없음: ${missing.join(", ")}`);
}
// ONLY_NEW=1: 명소는 지난 결과에 없는 곳만 찾아 더하고, 장소는 건너뛴다
if (process.env.ONLY_NEW) {
  const prevSpots = JSON.parse(fs.readFileSync(path.join("src", "data", "korea", "spot-kto.json"), "utf8")) as Record<string, unknown>;
  await match(
    landmarks.filter((l) => !prevSpots[l.id]),
    "spot-kto.json",
  );
} else {
  await match(landmarks, "spot-kto.json");
  await match(placeTargets, "place-kto.json");
}
