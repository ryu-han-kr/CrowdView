// 백필 원본(HIST_DIR) → 모델용 작은 파일(src/data/history/*.json). 실행: node --max-old-space-size=8000 scripts/history/build.mjs
import fs from "node:fs";
import zlib from "node:zlib";
import { HIST, WTDIR } from "./env.mjs";

const OUT = `${WTDIR}/src/data/history`;
fs.mkdirSync(OUT, { recursive: true });

// ── 공휴일 (2022~2026, 대체·임시 포함)
const HOL = new Set(`2022-01-01 2022-01-31 2022-02-01 2022-02-02 2022-03-01 2022-03-09 2022-05-05 2022-05-08 2022-06-01 2022-06-06 2022-08-15 2022-09-09 2022-09-10 2022-09-11 2022-09-12 2022-10-03 2022-10-09 2022-10-10 2022-12-25
2023-01-01 2023-01-21 2023-01-22 2023-01-23 2023-01-24 2023-03-01 2023-05-05 2023-05-27 2023-05-29 2023-06-06 2023-08-15 2023-09-28 2023-09-29 2023-09-30 2023-10-02 2023-10-03 2023-10-09 2023-12-25
2024-01-01 2024-02-09 2024-02-10 2024-02-11 2024-02-12 2024-03-01 2024-04-10 2024-05-05 2024-05-06 2024-05-15 2024-06-06 2024-08-15 2024-09-16 2024-09-17 2024-09-18 2024-10-01 2024-10-03 2024-10-09 2024-12-25
2025-01-01 2025-01-27 2025-01-28 2025-01-29 2025-01-30 2025-03-01 2025-03-03 2025-05-05 2025-05-06 2025-06-03 2025-06-06 2025-08-15 2025-10-03 2025-10-05 2025-10-06 2025-10-07 2025-10-08 2025-10-09 2025-12-25
2026-01-01 2026-02-16 2026-02-17 2026-02-18 2026-03-01 2026-03-02 2026-05-05 2026-05-24 2026-05-25 2026-06-03 2026-06-06 2026-08-15 2026-08-17 2026-09-24 2026-09-25 2026-09-26 2026-10-03 2026-10-05 2026-10-09 2026-12-25`.split(/\s+/));
const iso = (d) => (d.includes("-") ? d : `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
const dow = (d) => new Date(`${iso(d)}T00:00:00Z`).getUTCDay();
/** 0 평일 · 1 주말·공휴일 */
const dtOf = (d) => (HOL.has(iso(d)) || dow(d) === 0 || dow(d) === 6 ? 1 : 0);
const monthOf = (d) => +iso(d).slice(5, 7) - 1;

// ── 지오메트리
function ringContains(ring, x, y) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function polyContains(geom, x, y) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return polys.some((p) => ringContains(p[0], x, y) && !p.slice(1).some((h) => ringContains(h, x, y)));
}
function loadGeo(file, filter) {
  const g = JSON.parse(fs.readFileSync(file, "utf8"));
  return g.features.filter(filter).map((f) => {
    let minx = 999, miny = 999, maxx = -999, maxy = -999;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polys) for (const [x, y] of p[0]) (minx = Math.min(minx, x)), (maxx = Math.max(maxx, x)), (miny = Math.min(miny, y)), (maxy = Math.max(maxy, y));
    return { p: f.properties, geom: f.geometry, bb: [minx, miny, maxx, maxy] };
  });
}
const findIn = (feats, lng, lat) => feats.find((f) => lng >= f.bb[0] && lng <= f.bb[2] && lat >= f.bb[1] && lat <= f.bb[3] && polyContains(f.geom, lng, lat));

const seoulDongs = loadGeo(`${HIST}/geo/dong2016.geojson`, (f) => f.properties.adm_cd?.startsWith("11"));
seoulDongs.forEach((f) => (f.code = f.p.adm_cd.slice(0, 8)));
// 동 면적: 50m 격자 표본 수 (같은 격자로 원 안 몫을 재서 비율이 맞게)
const STEP = 0.0005; // 위도 약 55m
const cosLat = Math.cos((37.55 * Math.PI) / 180);
for (const f of seoulDongs) {
  let n = 0;
  for (let y = Math.ceil(f.bb[1] / STEP) * STEP; y <= f.bb[3]; y += STEP)
    for (let x = Math.ceil(f.bb[0] / (STEP / cosLat)) * (STEP / cosLat); x <= f.bb[2]; x += STEP / cosLat) if (polyContains(f.geom, x, y)) n++;
  f.cells = Math.max(1, n);
}
const allDongs = loadGeo(`${HIST}/geo/dong2026.geojson`, () => true);

/** 반경 r(m) 원 안에 든 행정동별 몫: w = (원∩동 격자 수)/(동 격자 수). 원 안 인구 ≈ Σ w × 동 인구 */
function dongWeights(lat, lng, r) {
  const dy = r / 111_000, dx = dy / cosLat;
  const counts = new Map();
  for (let y = Math.ceil((lat - dy) / STEP) * STEP; y <= lat + dy; y += STEP)
    for (let x = Math.ceil((lng - dx) / (STEP / cosLat)) * (STEP / cosLat); x <= lng + dx; x += STEP / cosLat) {
      const m = Math.hypot((y - lat) * 111_000, (x - lng) * 111_000 * cosLat);
      if (m > r) continue;
      const f = findIn(seoulDongs, x, y);
      if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
  return [...counts].map(([f, n]) => [f.code, Math.round(Math.min(1, n / f.cells) * 1000) / 1000]).filter(([, w]) => w >= 0.005).sort((a, b) => b[1] - a[1]);
}

// ── 대상
const ent = JSON.parse(fs.readFileSync(`${HIST}/entities.json`, "utf8"));
const landmarks = JSON.parse(fs.readFileSync(`${WTDIR}/src/data/korea/landmarks.json`, "utf8"));
const spots = JSON.parse(fs.readFileSync(`${WTDIR}/src/data/korea/spots.json`, "utf8"));
const spotRegion = JSON.parse(fs.readFileSync(`${WTDIR}/src/data/korea/spot-region.json`, "utf8"));
const inSeoul = (lat, lng) => !!findIn(seoulDongs, lng, lat);
const sggOf = (lat, lng) => findIn(allDongs, lng, lat)?.p;

const W = { area: {}, place: {}, landmark: {} };
for (const a of ent.areas) W.area[a.code] = dongWeights(a.lat, a.lng, 500);
for (const p of ent.places) if (inSeoul(p.lat, p.lng)) W.place[p.id] = dongWeights(p.lat, p.lng, 300);
for (const l of landmarks) if (inSeoul(l.lat, l.lng)) W.landmark[l.id] = dongWeights(l.lat, l.lng, 400);
console.log("weights", Object.keys(W.area).length, Object.keys(W.place).length, Object.keys(W.landmark).length);
const usedDongs = new Set(Object.values(W).flatMap((g) => Object.values(g).flatMap((ws) => ws.map(([c]) => c))));
console.log("used dongs", usedDongs.size);

// ── 서울 행정동 생활인구 (파일, 2023-01 ~ 2026-07): 월×일종류×시 평균
const files = fs.readdirSync(`${HIST}/dong`);
function profileOf(prefix) {
  const sum = new Map(), cnt = new Map();
  let days = 0, first = "99999999", last = "0";
  for (const f of files.filter((x) => x.startsWith(prefix)).sort()) {
    const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(`${HIST}/dong/${f}`)).toString("utf8"));
    for (const [d, dongs] of Object.entries(data)) {
      days++;
      if (d < first) first = d;
      if (d > last) last = d;
      const base = (monthOf(d) * 2 + dtOf(d)) * 24;
      for (const [code, hrs] of Object.entries(dongs)) {
        if (!sum.has(code)) sum.set(code, new Float64Array(576)), cnt.set(code, new Uint16Array(576));
        const s = sum.get(code), c = cnt.get(code);
        for (let h = 0; h < 24; h++) if (hrs[h] > 0) (s[base + h] += hrs[h]), c[base + h]++;
      }
    }
  }
  const out = {};
  for (const [code, s] of sum) out[code] = Array.from(s, (v, i) => (cnt.get(code)[i] ? v / cnt.get(code)[i] : 0));
  return { out, days, first, last };
}
const local = profileOf("LOCAL_");
console.log("local days", local.days, local.first, local.last, "dongs", Object.keys(local.out).length);
const foreign = profileOf("TEMP_FOREIGNER_");
console.log("foreign days", foreign.days, foreign.first, foreign.last);

// 저장: 쓰는 동만. 월(12)×일종류(2)×시(24) = 576칸, 사람 수 정수
const dongOut = {};
for (const code of [...usedDongs].sort()) {
  const p = local.out[code];
  if (!p) { console.log("no profile", code); continue; }
  // 단기체류 외국인(관광객): 월(12) 평균 (낮 10~21시)
  const fp = foreign.out[code];
  const fm = fp ? Array.from({ length: 12 }, (_, m) => { let s = 0, n = 0; for (const dt of [0, 1]) for (let h = 10; h < 22; h++) (s += fp[(m * 2 + dt) * 24 + h]), n++; return Math.round(s / n); }) : undefined;
  dongOut[code] = { p: p.map((v) => Math.round(v)), ...(fm ? { f: fm } : {}) };
}

// ── 데이터랩 시군구 일별 방문자 (2022-01 ~): 외지인+외국인(v), 현지인 포함 전체(t)
const sgg = new Map(); // code -> {name?, days: Map(date -> [v, t])}
for (const line of fs.readFileSync(`${HIST}/datalab_locgo.jsonl`, "utf8").split("\n")) {
  if (!line) continue;
  for (const [code, ymd, tou, num] of JSON.parse(line).rows) {
    if (!sgg.has(code)) sgg.set(code, new Map());
    const m = sgg.get(code);
    const cur = m.get(ymd) ?? [0, 0];
    if (tou !== 1) cur[0] += num;
    cur[1] += num;
    m.set(ymd, cur);
  }
}
let dlFirst = "9", dlLast = "0";
const sggOut = {};
for (const [code, days] of sgg) {
  const s = Array(24).fill(0), n = Array(24).fill(0), st = Array(24).fill(0);
  let holS = 0, holN = 0, weS = 0, weN = 0;
  const byYear = {};
  for (const [d, [v, t]] of days) {
    if (d < dlFirst) dlFirst = d;
    if (d > dlLast) dlLast = d;
    const i = monthOf(d) * 2 + dtOf(d);
    s[i] += v, st[i] += t, n[i]++;
    const wk = dow(d) === 0 || dow(d) === 6;
    if (HOL.has(iso(d)) && !wk) holS += v, holN++;
    else if (wk) weS += v, weN++;
    const y = d.slice(0, 4);
    (byYear[y] ??= [0, 0]), (byYear[y][0] += v), byYear[y][1]++;
  }
  const mean = s.reduce((a, b) => a + b, 0) / n.reduce((a, b) => a + b, 0);
  if (!(mean > 0)) continue;
  const tmean = st.reduce((a, b) => a + b, 0) / n.reduce((a, b) => a + b, 0);
  sggOut[code] = {
    // 하루 평균 방문자 (외지인+외국인)
    v: Math.round(mean),
    // 월(12)×일종류(2) 방문자 지수 (전체 평균 = 1000)
    i: s.map((x, k) => (n[k] ? Math.round(((x / n[k]) / mean) * 1000) : 1000)),
    // 현지인 포함 전체 지수
    t: st.map((x, k) => (n[k] ? Math.round(((x / n[k]) / tmean) * 1000) : 1000)),
    // 평일 공휴일 ÷ 주말 (연휴 효과)
    ...(holN >= 5 && weN ? { h: Math.round((holS / holN / (weS / weN)) * 100) / 100 } : {}),
    // 해마다 하루 평균 (추세)
    y: Object.fromEntries(Object.entries(byYear).filter(([, [, c]]) => c >= 200).map(([y, [a, c]]) => [y, Math.round(a / c)])),
  };
}
console.log("sigungu", Object.keys(sggOut).length, dlFirst, dlLast);

// ── 장소·명소 → 시군구 코드 (데이터랩 코드에 없으면 같은 시의 옛 코드·이름으로)
const sggNames = new Map();
for (const f of allDongs) sggNames.set(f.p.sgg, f.p.sggnm);
function sggFor(lat, lng) {
  const p = sggOf(lat, lng);
  if (!p) return undefined;
  if (sggOut[p.sgg]) return p.sgg;
  // 부천(41190)·군위(27720 ← 47720) 등 코드가 바뀐 곳: 앞 4자리 같은 코드 중 데이터 있는 것
  const alt = Object.keys(sggOut).find((c) => c.slice(0, 4) === p.sgg.slice(0, 4));
  return alt;
}
const placeOut = {};
for (const p of ent.places) {
  const code = sggFor(p.lat, p.lng);
  placeOut[p.id] = { ...(code ? { g: code } : {}), ...(W.place[p.id] ? { d: W.place[p.id] } : {}) };
}
const lmOut = {};
for (const l of landmarks) {
  const code = spotRegion[l.id]?.code && sggOut[spotRegion[l.id].code] ? spotRegion[l.id].code : sggFor(l.lat, l.lng);
  lmOut[l.id] = { ...(code ? { g: code } : {}), ...(W.landmark[l.id] ? { d: W.landmark[l.id] } : {}) };
}
let spotsMapped = 0;
const spotOut = {};
for (const s of spots) {
  const [id, , , , lat, lng] = s;
  const code = sggFor(lat, lng);
  if (code) (spotOut[id] = code), spotsMapped++;
}
console.log("places with sgg", Object.values(placeOut).filter((x) => x.g).length, "/", ent.places.length, "landmarks", Object.values(lmOut).filter((x) => x.g).length, "spots", spotsMapped);

// 쓰는 시군구만 남김
const usedSgg = new Set([...Object.values(placeOut).map((x) => x.g), ...Object.values(lmOut).map((x) => x.g), ...Object.values(spotOut)].filter(Boolean));
const sggKeep = Object.fromEntries(Object.entries(sggOut).filter(([c]) => usedSgg.has(c)).map(([c, v]) => [c, { n: sggNames.get(c), ...v }]));

// ── 부산 행정동 월별 시간대 (2023-01 ~): 월(12) 평균 곡선 24칸
const busan = JSON.parse(fs.readFileSync(`${HIST}/busan_dong_time.json`, "utf8"));
const busanOut = {};
for (const [d, months] of Object.entries(busan)) {
  const s = Array.from({ length: 12 }, () => Array(24).fill(0)), n = Array(12).fill(0);
  for (const [ym, hrs] of Object.entries(months)) {
    const m = +ym.slice(4) - 1;
    hrs.forEach((v, h) => (s[m][h] += v));
    n[m]++;
  }
  busanOut[d] = s.map((row, m) => row.map((v) => Math.round(v / Math.max(1, n[m]))));
}

const meta = {
  built: new Date().toISOString().slice(0, 10),
  sources: {
    seoulDong: { name: "서울 생활인구(내국인) 행정동 OA-14991", from: iso(local.first), to: iso(local.last), days: local.days },
    seoulForeign: { name: "서울 생활인구(단기체류 외국인) 행정동 OA-14993", from: iso(foreign.first), to: iso(foreign.last), days: foreign.days },
    datalab: { name: "한국관광공사 데이터랩 기초지자체 방문자 수(locgoRegnVisitrDDList)", from: iso(dlFirst), to: iso(dlLast) },
    busan: { name: "부산광역시 행정동 생활인구(시간대) 15164444", from: "2023-01", to: "2026-09" },
  },
};
const write = (name, obj) => {
  const s = JSON.stringify(obj);
  fs.writeFileSync(`${OUT}/${name}`, s + "\n");
  console.log(name, (s.length / 1024).toFixed(0), "KB");
};
// ── 서울 지하철 역별 승하차: 일별(2023-01 ~) + 월별 시간대(최근 12달)
const normSt = (s) => { const t = s.replace(/\(.*?\)/g, "").trim(); return t.length > 2 && t.endsWith("역") ? t.slice(0, -1) : t; };
const stDays = new Map(); // name -> Map(date -> on+off)
const addDay = (d, key, on, off) => {
  const name = normSt(key.includes("|") ? key.split("|")[1] : key);
  if (!stDays.has(name)) stDays.set(name, new Map());
  const m = stDays.get(name);
  m.set(d, (m.get(d) ?? 0) + on + off);
};
let stLast = "0";
for (const f of files.filter((x) => x.startsWith("SUBWAY_DAY_")).sort()) {
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(`${HIST}/dong/${f}`)).toString("utf8"));
  for (const [d, sts] of Object.entries(data)) {
    if (d > stLast) stLast = d;
    for (const [k, [on, off]] of Object.entries(sts)) addDay(d, k, on, off);
  }
}
const fileLast = stLast;
for (const line of fs.readFileSync(`${HIST}/subway_daily.jsonl`, "utf8").split("\n")) {
  if (!line) continue;
  const { d, rows } = JSON.parse(line);
  if (d <= fileLast || !rows.length) continue;
  if (d > stLast) stLast = d;
  for (const [ln, st, on, off] of rows) addDay(d, `${ln}|${st}`, on, off);
}
const stHour = new Map();
const tm = fs.readFileSync(`${HIST}/subway_time_monthly.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.d.localeCompare(b.d)).slice(-12);
for (const { rows } of tm)
  for (const [, st, ...v] of rows) {
    const name = normSt(st);
    const a = stHour.get(name) ?? Array(24).fill(0);
    for (let h = 0; h < 24; h++) a[h] += v[h * 2] + v[h * 2 + 1];
    stHour.set(name, a);
  }
const subway = JSON.parse(fs.readFileSync(`${WTDIR}/src/data/seoul/subway.json`, "utf8")).s;
const near = (lat, lng, r) =>
  subway.map(([n, la, ln]) => [normSt(n), Math.round(Math.hypot((la - lat) * 111_000, (ln - lng) * 111_000 * cosLat))]).filter(([n, m]) => m <= r && stDays.has(n)).sort((a, b) => a[1] - b[1]).slice(0, 3);
const stTargets = { area: {}, place: {}, landmark: {} };
for (const a of ent.areas) { const s = near(a.lat, a.lng, 700); if (s.length) stTargets.area[a.code] = s; }
for (const p of ent.places) if (W.place[p.id]) { const s = near(p.lat, p.lng, 600); if (s.length) stTargets.place[p.id] = s; }
for (const l of landmarks) if (W.landmark[l.id]) { const s = near(l.lat, l.lng, 600); if (s.length) stTargets.landmark[l.id] = s; }
const usedSt = new Set(Object.values(stTargets).flatMap((g) => Object.values(g).flatMap((ss) => ss.map(([n]) => n))));
const stOut = {};
for (const name of [...usedSt].sort()) {
  const days = stDays.get(name);
  const s = Array(24).fill(0), n = Array(24).fill(0);
  for (const [d, v] of days) if (v > 0) (s[monthOf(d) * 2 + dtOf(d)] += v), n[monthOf(d) * 2 + dtOf(d)]++;
  const cellMean = s.map((x, k) => (n[k] ? x / n[k] : 0));
  const mean = s.reduce((a, b) => a + b, 0) / Math.max(1, n.reduce((a, b) => a + b, 0));
  // 평소(같은 달·같은 일종류)보다 크게 붐빈 날 (축제·행사): 상위 8일
  const top = [...days].filter(([, v]) => v > 0).map(([d, v]) => [iso(d), Math.round((v / cellMean[monthOf(d) * 2 + dtOf(d)]) * 100) / 100]).filter(([, r]) => r >= 1.3).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const hr = stHour.get(name);
  const hsum = hr?.reduce((a, b) => a + b, 0);
  stOut[name] = {
    v: Math.round(mean),
    i: cellMean.map((x) => (x ? Math.round((x / mean) * 1000) : 1000)),
    ...(hsum ? { hr: hr.map((x) => Math.round((x / hsum) * 1000)) } : {}),
    ...(top.length ? { top } : {}),
  };
}
meta.sources.subway = { name: "서울시 지하철 호선별 역별 승하차 인원 OA-12914 + 시간대별 OA-12252", from: "2023-01-01", to: iso(stLast) };
console.log("stations", Object.keys(stOut).length, "last", stLast);

write("seoul-dong.json", { meta, dongs: dongOut });
write("sigungu.json", { meta, sgg: sggKeep });
write("targets.json", { area: W.area, place: placeOut, landmark: lmOut, spot: spotOut, station: stTargets });
write("subway.json", { meta: meta.sources.subway, st: stOut });

// ── 월 계절 지수 (모델용 작은 파일): 장소 = 시군구 방문자(외지인+외국인), 서울 지역 = 반경 500m 생활인구 낮(10~21시)
const norm12 = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / 12; return xs.map((x) => Math.round((x / m) * 1000)); };
const season = { place: {}, area: {} };
for (const [id, p] of Object.entries(placeOut)) {
  const s = p.g && sggOut[p.g];
  if (s) season.place[id] = norm12(Array.from({ length: 12 }, (_, m) => (5 * s.i[m * 2] + 2 * s.i[m * 2 + 1]) / 7));
}
for (const [code, ws] of Object.entries(W.area)) {
  const mm = Array.from({ length: 12 }, (_, m) => {
    let t = 0;
    for (const [c, w] of ws) { const p = dongOut[c]?.p; if (p) for (const dt of [0, 1]) for (let h = 10; h < 22; h++) t += p[(m * 2 + dt) * 24 + h] * w * (dt ? 2 : 5); }
    return t;
  });
  if (mm.some((x) => x > 0)) season.area[code] = norm12(mm);
}
write("season.json", season);
write("busan-dong.json", busanOut);
