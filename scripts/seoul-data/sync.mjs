// 서울시 열린데이터광장 정적 데이터 동기화 → src/data/seoul/*.json
// 화장실·와이파이·문화공간·Visit Seoul 다국어 관광정보·공공서비스 예약은 자주 바뀌지 않아서
// 주 1회 받아 정리한 파일을 저장소에 두고, 사이트는 이 파일만 읽는다 (이용자가 늘어도 API 호출·서버 비용 0).
// 사용: node scripts/seoul-data/sync.mjs   (SEOUL_OPENAPI_KEY: .env.local 또는 환경변수)
import fs from "node:fs";
import path from "node:path";
import { buildStationProfile } from "./station-profile.mjs";
import { buildSubway } from "./subway.mjs";

if (!process.env.SEOUL_OPENAPI_KEY && fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const KEY = process.env.SEOUL_OPENAPI_KEY;
if (!KEY) {
  console.error("SEOUL_OPENAPI_KEY가 없어요");
  process.exit(1);
}
const OUT = path.join("src", "data", "seoul");
fs.mkdirSync(OUT, { recursive: true });

/** 서비스 전체를 1000건씩 받는다. param: 날짜처럼 주소 끝에 붙는 값 (예: 202609) */
async function fetchAll(service, param = "") {
  const rows = [];
  for (let start = 1; ; start += 1000) {
    const url = `http://openapi.seoul.go.kr:8088/${KEY}/json/${service}/${start}/${start + 999}/${param}`;
    let json;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        json = await res.json();
        break;
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }
    const body = json[service] ?? Object.values(json).find((v) => v && typeof v === "object" && "row" in v);
    if (!body?.row?.length) break;
    rows.push(...body.row);
    if (rows.length >= Number(body.list_total_count)) break;
  }
  console.log(`${service}: ${rows.length}`);
  return rows;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? Math.round(n * 1e5) / 1e5 : undefined;
};
// 서울시 API 글자에 HTML 문자 참조가 겹쳐 오기도 한다 (&amp;lt; → <). 더 바뀌지 않을 때까지 푼다
const ENTITY = { lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", amp: "&" };
const unescape = (s) => {
  for (let i = 0; i < 3; i++) {
    const next = s.replace(/&(lt|gt|quot|#39|apos|amp);/g, (_, e) => ENTITY[e]);
    if (next === s) break;
    s = next;
  }
  return s;
};
const clean = (s) => unescape(String(s ?? "")).replace(/\r/g, "").replace(/\s+\n/g, "\n").trim();
const inSeoul = (lat, lng) => lat > 37.4 && lat < 37.72 && lng > 126.76 && lng < 127.19;
let changed = false;
const write = (name, data) => {
  const file = path.join(OUT, name);
  const next = JSON.stringify(data);
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== next) changed = true;
  fs.writeFileSync(file, next);
  console.log(`  → ${name} ${(fs.statSync(path.join(OUT, name)).size / 1024).toFixed(0)}KB`);
};

// ── 주소 → 좌표 (키가 있는 쪽을 쓴다: 카카오 로컬 → 네이버 NCP Geocoding). 결과는 geocode.json에 모아 두고 새 주소만 묻는다
const GEO_FILE = path.join(OUT, "geocode.json");
const geoCache = fs.existsSync(GEO_FILE) ? JSON.parse(fs.readFileSync(GEO_FILE, "utf8")) : {};
const KAKAO = process.env.KAKAO_REST_API_KEY ?? process.env.KAKAO_CLIENT_ID;
const NCP_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const NCP_SECRET = process.env.NAVER_MAP_CLIENT_SECRET;
let geoAsked = 0;
// 요금 보호: 실행 한 번에 묻는 주소 수 상한 (처음 약 2,000건, 이후 주마다 새 주소 몇 건)
const MAX_GEOCODE_PER_RUN = 3000;
let geoProvider = KAKAO ? "kakao" : NCP_ID && NCP_SECRET ? "ncp" : null;
async function geocode(address) {
  const q = address.replace(/^\d{5}\s*/, "").replace(/\(.*?\)/g, "").replace(/\s+\S*(층|호|F)\s*$/i, "").trim();
  if (!q) return undefined;
  if (q in geoCache) return geoCache[q] ?? undefined;
  if (!geoProvider || geoAsked >= MAX_GEOCODE_PER_RUN) return undefined;
  geoAsked++;
  try {
    let hit;
    if (geoProvider === "kakao") {
      const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}`, {
        headers: { Authorization: `KakaoAK ${KAKAO}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401 || res.status === 403) throw new Error(`kakao ${res.status} (카카오맵 서비스 활성화 확인)`);
      const d = (await res.json()).documents?.[0];
      if (d) hit = [Number(d.y), Number(d.x)];
    } else {
      const res = await fetch(`https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(q)}`, {
        headers: { "x-ncp-apigw-api-key-id": NCP_ID, "x-ncp-apigw-api-key": NCP_SECRET },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401 || res.status === 403) throw new Error(`ncp ${res.status} (콘솔에서 Geocoding 사용 설정 확인)`);
      const a = (await res.json()).addresses?.[0];
      if (a) hit = [Number(a.y), Number(a.x)];
    }
    geoCache[q] = hit ? [Math.round(hit[0] * 1e5) / 1e5, Math.round(hit[1] * 1e5) / 1e5] : null;
    return geoCache[q] ?? undefined;
  } catch (e) {
    console.warn(`  주소 변환 중단: ${e.message}`);
    geoProvider = null; // 키 문제면 이번 실행에서는 더 묻지 않는다 (역 위치로 대신)
    return undefined;
  }
}

// ── 지하철역 좌표 (Visit Seoul은 좌표가 없어 '가까운 역'으로 위치를 잡는다)
const stationRows = await fetchAll("subwayStationMaster");
const normStation = (s) => s.replace(/\(.*?\)/g, "").replace(/\s/g, "").replace(/역$/, "");
const stations = new Map();
for (const r of stationRows) {
  const lat = num(r.LAT);
  const lng = num(r.LOT);
  if (lat && lng && !stations.has(normStation(r.BLDN_NM))) stations.set(normStation(r.BLDN_NM), { lat, lng });
}
function stationOf(subwayInfo) {
  const text = clean(subwayInfo);
  for (const m of text.matchAll(/([가-힣0-9·\s]{1,16}?)역/g)) {
    // "수인분당선 선정릉" · "을지로 3가" → 마지막 낱말, 마지막 두 낱말을 차례로 맞춰 본다
    const words = m[1].trim().split(/\s+/).filter((w) => !/(호선|선|철도)$/.test(w) || w.length <= 2);
    for (const cand of [words.slice(-1).join(""), words.slice(-2).join(""), words.join("")]) {
      const name = normStation(cand.replace(/^[0-9/]+/, ""));
      if (name && stations.has(name)) return { name, ...stations.get(name) };
    }
  }
  return undefined;
}

// ── 지하철 노선망 (추천 코스 이동시간): 1~8호선은 실제 역간 시간, 나머지 노선은 역 좌표로 어림
{
  const { data, missing } = buildSubway(stationRows, await fetchAll("StationDstncReqreTimeHm"));
  if (missing.length) console.warn(`  좌표를 못 찾은 역: ${missing.join(", ")}`);
  write("subway.json", data);
}

// ── 역별 혼잡 모양 (코스 추천의 내일·주말 예측)
{
  const profile = await buildStationProfile(fetchAll, normStation);
  console.log(`  역별 혼잡 모양 ${Object.keys(profile.s).length}역 (${profile.month} 시간대 · 최근 ${profile.days}일 요일)`);
  write("station-profile.json", profile);
}

// ── 공중화장실 4,455곳 (서울시 공중화장실 위치정보)
// flags: 1 24시간 · 2 장애인 화장실 · 4 기저귀 교환대 · 8 비상벨/CCTV · 16 민간 개방
{
  const rows = await fetchAll("mgisToiletPoi");
  const has = (v) => !!String(v ?? "").replace(/\|/g, "").trim();
  // 운영 시간: 괄호 짝부터 맞추고(닫는 괄호만 남은 건 지우고 안 닫힌 건 닫는다) "정시(06:00~24:00)" → "06:00~24:00"
  // (예전엔 앞뒤 괄호만 잘라 "상시(24시간", "07:00~21:00) 기타"처럼 깨졌다)
  const hoursText = (h) => {
    let open = 0;
    let s = "";
    for (const c of h) {
      if (c === ")") {
        if (!open) continue;
        open--;
      } else if (c === "(") open++;
      s += c;
    }
    return (s + ")".repeat(open)).replace(/정시\(([^()]*)\)/g, "$1").trim();
  };
  const out = rows
    .map((r) => {
      const lat = num(r.COORD_Y);
      const lng = num(r.COORD_X);
      if (!lat || !lng || !inSeoul(lat, lng)) return null;
      const hours = clean(r.VALUE_02).replace(/\|/g, " ").trim();
      const flags =
        (/24시간/.test(hours) ? 1 : 0) | (has(r.VALUE_05) ? 2 : 0) | (has(r.VALUE_06) ? 4 : 0) | (has(r.VALUE_07) ? 8 : 0) | (/민간/.test(r.VALUE_01) ? 16 : 0);
      return [clean(r.CONTS_NAME), lat, lng, flags, hoursText(hours), clean(r.VALUE_03).replace(/\|/g, " ").trim(), clean(r.GU_NAME)];
    })
    .filter(Boolean);
  write("toilets.json", out);
}

// ── 공공 와이파이 (위치만)
{
  const rows = await fetchAll("TbPublicWifiInfo");
  const seen = new Set();
  const out = rows
    .map((r) => {
      const lat = num(r.LAT);
      const lng = num(r.LNT);
      if (!lat || !lng || !inSeoul(lat, lng)) return null;
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (seen.has(key)) return null; // 같은 자리 AP 여러 대는 하나로
      seen.add(key);
      return [clean(r.X_SWIFI_MAIN_NM).slice(0, 40), lat, lng, r.X_SWIFI_INOUT_DOOR === "실외" ? 1 : 0];
    })
    .filter(Boolean);
  write("wifi.json", out);
}

// ── 문화공간 (박물관·미술관·공연장 등)
{
  const rows = await fetchAll("culturalSpaceInfo");
  const out = rows
    .map((r) => {
      const lat = num(r.X_COORD);
      const lng = num(r.Y_COORD);
      if (!lat || !lng || !inSeoul(lat, lng)) return null;
      return {
        n: clean(r.FAC_NAME),
        k: clean(r.SUBJCODE),
        a: clean(r.ADDR),
        gu: clean(r.GNGU),
        lat,
        lng,
        tel: clean(r.PHNE) || undefined,
        web: clean(r.HOMEPAGE) || undefined,
        h: clean(r.OPENHOUR) || undefined,
        off: clean(r.CLOSEDAY) || undefined,
        fee: clean(r.ENTR_FEE) || undefined,
        img: clean(r.MAIN_IMG) || undefined,
      };
    })
    .filter(Boolean);
  write("culture.json", out);
}

// ── Visit Seoul 다국어 관광정보: 관광명소·음식점·쇼핑·자연 (같은 장소의 언어별 글을 주소 코드로 묶는다)
{
  const KINDS = { TbVwAttractions: "attraction", TbVwRestaurants: "food", TbVwShopping: "shopping", TbVwNature: "nature" };
  const places = [];
  for (const [service, kind] of Object.entries(KINDS)) {
    const rows = await fetchAll(service);
    const groups = new Map();
    for (const r of rows) {
      const code = r.POST_URL?.match(/\/[A-Z]{2,4}([A-Za-z0-9]{5,})\?/)?.[1];
      if (!code) continue;
      const g = groups.get(code) ?? {};
      g[r.LANG_CODE_ID] = r;
      groups.set(code, g);
    }
    for (const [code, g] of groups) {
      const ko = g.ko;
      const st = stationOf(ko?.SUBWAY_INFO ?? "");
      // 한국어 주소로 정확한 좌표 (없으면 가까운 역 좌표)
      const exact = ko ? await geocode(clean(ko.NEW_ADDRESS || ko.ADDRESS)) : undefined;
      const gu = clean(ko?.NEW_ADDRESS ?? ko?.ADDRESS).match(/서울(?:특별시)?\s+(\S+구)/)?.[1];
      const t = {};
      for (const [lang, r] of Object.entries(g)) {
        t[lang] = {
          n: clean(r.POST_SJ),
          a: clean(r.NEW_ADDRESS || r.ADDRESS).replace(/^\d{5}\s*/, ""),
          h: clean(r.CMMN_USE_TIME) || undefined,
          off: clean(r.CMMN_RSTDE) || undefined,
          tel: clean(r.CMMN_TELNO) || undefined,
          sub: clean(r.SUBWAY_INFO) || undefined,
          menu: clean(r.FD_REPRSNT_MENU) || undefined,
          tags: clean(r.TAG) || undefined,
          url: String(r.POST_URL ?? "").replace(/\?.*$/, ""),
          web: clean(r.CMMN_HMPG_URL) || undefined,
        };
      }
      places.push({
        id: `vs-${code}`,
        kind,
        gu,
        ...(exact ? { lat: exact[0], lng: exact[1], exact: true } : st ? { lat: st.lat, lng: st.lng } : {}),
        ...(st && { station: st.name }),
        t,
      });
    }
  }
  console.log(
    `  위치를 잡은 곳 ${places.filter((p) => p.lat).length} / ${places.length} (주소 좌표 ${places.filter((p) => p.exact).length}, 이번에 물어본 주소 ${geoAsked}, ${geoProvider ?? "주소 변환 없음"})`,
  );
  fs.writeFileSync(GEO_FILE, JSON.stringify(geoCache));
  write("guide.json", places);
}

// ── 공공서비스 예약: 문화체험 중 지금 접수 중·안내 중인 것
{
  const rows = await fetchAll("ListPublicReservationCulture");
  const out = rows
    .filter((r) => r.SVCSTATNM === "접수중" || r.SVCSTATNM === "안내중")
    .map((r) => ({
      id: r.SVCID,
      n: clean(r.SVCNM),
      cat: clean(r.MINCLASSNM),
      place: clean(r.PLACENM),
      gu: clean(r.AREANM),
      fee: clean(r.PAYATNM),
      who: clean(r.USETGTINFO),
      url: unescape(String(r.SVCURL ?? "")),
      img: r.IMGURL || undefined,
      lat: num(r.Y),
      lng: num(r.X),
      from: String(r.SVCOPNBGNDT ?? "").slice(0, 10),
      to: String(r.SVCOPNENDDT ?? "").slice(0, 10),
      rcptEnd: String(r.RCPTENDDT ?? "").slice(0, 16),
      status: r.SVCSTATNM,
    }));
  write("reservations.json", out);
}

// 데이터가 바뀐 경우에만 갱신 시각을 바꾼다 (바뀐 게 없으면 주간 PR도 생기지 않는다)
if (changed || !fs.existsSync(path.join(OUT, "meta.json"))) {
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ syncedAt: new Date().toISOString() }));
}
console.log(changed ? "완료 (변경 있음)" : "완료 (변경 없음)");
