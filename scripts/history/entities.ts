// 백필·집계 대상 목록 (장소 242·서울 지역 121) → HIST_DIR/entities.json. 실행: npx tsx scripts/history/entities.ts .history-raw/entities.json
import fs from "node:fs";
import { PLACES } from "../../src/lib/places";
import { SEOUL_AREAS } from "../../src/lib/seoul-areas";
const out = PLACES.map((p) => ({ id: p.id, name: p.name, category: p.category, region: p.region, lat: p.lat, lng: p.lng, seoulArea: p.seoulArea, busanDongs: p.busanDongs, season: p.season, airport: p.airport, hours: p.hours }));
fs.writeFileSync(process.argv[2], JSON.stringify({ places: out, areas: SEOUL_AREAS }));
console.log(out.length, SEOUL_AREAS.length);
