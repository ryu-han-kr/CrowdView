// 서울 지역 중 고른 사진이 없고 역이 아닌 곳: 위키미디어 커먼즈에서 영어/한국어 이름으로 사진 후보
import fs from "node:fs";
import { SEOUL_AREAS } from "../../src/lib/seoul-areas.ts";
import { areaPhoto } from "../../src/lib/seoul-guide.ts";
const picked = JSON.parse(fs.readFileSync(process.cwd() + "/src/data/seoul/area-photos.json", "utf8"));
const UA = { "User-Agent": "CrowdView/1.0 (https://crowdview.app; photo curation)" };
async function search(q: string) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1280`;
  const j: any = await (await fetch(u, { headers: UA })).json();
  return Object.values(j.query?.pages ?? {}).map((p: any) => {
    const ii = p.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
    return { src: ii?.thumburl, w: ii?.width, h: ii?.height, page: ii?.descriptionurl, title: p.title, lic: m.LicenseShortName?.value ?? "", who: String(m.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 60) };
  }).filter((x) => x.src && x.w > x.h * 1.2 && x.w >= 1200 && /CC0|CC BY|Public domain/i.test(x.lic) && !/NC|ND/.test(x.lic));
}
const out: Record<string, any> = {};
const isStation = (n: string) => !/관광특구|공원|한강/.test(n) && (/역(\(|$|·)|역\s/.test(n) || n.endsWith("역"));
for (const a of SEOUL_AREAS as any[]) {
  if (picked[a.code] || isStation(a.name)) continue;
  const q = a.name.replace(/\(.*?\)|관광특구/g, "").replace(/·/g, " ").trim();
  const c = await search(`${q} Seoul`);
  out[a.code] = { kind: "commons", name: a.name, cur: areaPhoto(a), c: c.slice(0, 11) };
  process.stdout.write(`${a.code}:${c.length} `);
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
