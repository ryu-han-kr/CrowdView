const UA = { "User-Agent": "CrowdView/1.0 (https://crowdview.app; photo curation)" };
import fs from "node:fs";
const out: any = {};
for (const [id, q, cur] of JSON.parse(process.argv[3])) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j: any = await (await fetch(u, { headers: UA })).json();
  const c = Object.values(j.query?.pages ?? {}).map((p: any) => { const ii = p.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
    return { src: String(ii?.thumburl ?? "").split("?")[0], w: ii?.width, h: ii?.height, page: ii?.descriptionurl, title: p.title, lic: m.LicenseShortName?.value ?? "", who: String(m.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 60) }; })
    .filter((x) => x.src && x.w > x.h * 1.2 && x.w >= 1600 && /CC0|CC BY|Public domain/i.test(x.lic) && !/NC|ND/.test(x.lic));
  out[id] = { kind: "commons", name: q, cur, c: c.slice(0, 13) };
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
