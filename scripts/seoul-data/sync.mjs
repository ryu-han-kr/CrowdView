// 서울시 열린데이터광장 정적 데이터 동기화 → src/data/seoul/*.json
// 화장실·와이파이·문화공간·Visit Seoul 다국어 관광정보·공공서비스 예약은 자주 바뀌지 않아서
// 주 1회 받아 정리한 파일을 저장소에 두고, 사이트는 이 파일만 읽는다 (이용자가 늘어도 API 호출·서버 비용 0).
// 사용: node scripts/seoul-data/sync.mjs   (SEOUL_OPENAPI_KEY: .env.local 또는 환경변수)
import fs from "node:fs";
import path from "node:path";

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

/** 서비스 전체를 1000건씩 받는다 */
async function fetchAll(service) {
  const rows = [];
  for (let start = 1; ; start += 1000) {
    const url = `http://openapi.seoul.go.kr:8088/${KEY}/json/${service}/${start}/${start + 999}/`;
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
const clean = (s) => String(s ?? "").replace(/\r/g, "").replace(/\s+\n/g, "\n").trim();
const inSeoul = (lat, lng) => lat > 37.4 && lat < 37.72 && lng > 126.76 && lng < 127.19;
const write = (name, data) => {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data));
  console.log(`  → ${name} ${(fs.statSync(path.join(OUT, name)).size / 1024).toFixed(0)}KB`);
};

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

// ── 공중화장실 4,455곳 (서울시 공중화장실 위치정보)
// flags: 1 24시간 · 2 장애인 화장실 · 4 기저귀 교환대 · 8 비상벨/CCTV · 16 민간 개방
{
  const rows = await fetchAll("mgisToiletPoi");
  const has = (v) => !!String(v ?? "").replace(/\|/g, "").trim();
  const out = rows
    .map((r) => {
      const lat = num(r.COORD_Y);
      const lng = num(r.COORD_X);
      if (!lat || !lng || !inSeoul(lat, lng)) return null;
      const hours = clean(r.VALUE_02).replace(/\|/g, " ").trim();
      const flags =
        (/24시간/.test(hours) ? 1 : 0) | (has(r.VALUE_05) ? 2 : 0) | (has(r.VALUE_06) ? 4 : 0) | (has(r.VALUE_07) ? 8 : 0) | (/민간/.test(r.VALUE_01) ? 16 : 0);
      return [clean(r.CONTS_NAME), lat, lng, flags, hours.replace(/^정시\(|\)$/g, ""), clean(r.VALUE_03).replace(/\|/g, " ").trim(), clean(r.GU_NAME)];
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
      places.push({ id: `vs-${code}`, kind, gu, ...(st && { lat: st.lat, lng: st.lng, station: st.name }), t });
    }
  }
  console.log(`  위치를 잡은 곳 ${places.filter((p) => p.lat).length} / ${places.length}`);
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
      url: r.SVCURL,
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

fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ syncedAt: new Date().toISOString() }));
console.log("완료");
