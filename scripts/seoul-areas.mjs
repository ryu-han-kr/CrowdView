// 서울시 실시간 도시데이터 지역(POI001~) 이름과 중심 좌표 수집 → src/lib/seoul-areas.ts
import fs from "node:fs";
const key = process.env.SK;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : undefined; };
const out = [];
let misses = 0;
for (let i = 1; i <= 140 && misses < 8; i++) {
  const code = `POI${String(i).padStart(3, "0")}`;
  let c;
  try {
    const r = await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/citydata/1/5/${code}`, { signal: AbortSignal.timeout(30000) });
    c = (await r.json()).CITYDATA;
  } catch { c = undefined; }
  if (!c?.AREA_NM) { misses++; continue; }
  misses = 0;
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const lat = [], lng = [];
  for (const p of arr(c.PRK_STTS)) if (p.LAT) { lat.push(+p.LAT); lng.push(+p.LNG); }
  for (const p of arr(c.SUB_STTS)) if (p.SUB_STN_Y) { lat.push(+p.SUB_STN_Y); lng.push(+p.SUB_STN_X); }
  for (const p of arr(c.BUS_STN_STTS)) if (p.BUS_STN_Y) { lat.push(+p.BUS_STN_Y); lng.push(+p.BUS_STN_X); }
  for (const p of arr(c.CHARGER_STTS)) if (p.STAT_Y) { lat.push(+p.STAT_Y); lng.push(+p.STAT_X); }
  const la = med(lat.filter((v) => v > 37 && v < 38)), ln = med(lng.filter((v) => v > 126 && v < 128));
  out.push({ code, name: c.AREA_NM, lat: la ? +la.toFixed(5) : null, lng: ln ? +ln.toFixed(5) : null, n: lat.length });
  process.stdout.write(`${code} ${c.AREA_NM} ${la?.toFixed(4)},${ln?.toFixed(4)} (${lat.length})\n`);
}
const body = out.filter((a) => a.lat).map((a) => `  { code: "${a.code}", name: "${a.name}", lat: ${a.lat}, lng: ${a.lng} },`).join("\n");
fs.writeFileSync(process.argv[2], `// 서울시 실시간 도시데이터 지역 목록 (지역명은 citydata_ppltn 조회 키).
// 좌표는 지역 응답에 든 주차장·지하철역·버스정류장·충전소 좌표의 중앙값 (서울시가 중심 좌표를 주지 않아 직접 계산).
// 다시 만들기: node scripts/seoul-areas.mjs (서울시 키 필요). 수집일 ${new Date().toISOString().slice(0, 10)}
export interface SeoulArea {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export const SEOUL_AREAS: SeoulArea[] = [
${body}
];
`);
console.log("areas", out.length, "with coords", out.filter((a) => a.lat).length, "no coords:", out.filter((a) => !a.lat).map((a) => a.name).join(","));
