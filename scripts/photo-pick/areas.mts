import fs from "node:fs";
import { SEOUL_AREAS } from "../../src/lib/seoul-areas.ts";
import { areaPhoto } from "../../src/lib/seoul-guide.ts";
import picks from "../../src/data/seoul/area-photos.json" with { type: "json" };
const rows = (SEOUL_AREAS as any[]).filter((a) => !(picks as any)[a.code]).map((a) => ({ code: a.code, name: a.name, img: areaPhoto(a, true) ?? "" }));
const cells = rows.map((r) => `<div style="display:inline-block;width:150px;margin:3px;font:11px sans-serif;vertical-align:top"><img src="${r.img}" style="width:150px;height:100px;object-fit:cover;background:#ddd"><br>${r.code} ${r.name.slice(0, 14)}</div>`).join("");
fs.writeFileSync(process.argv[2], `<html><body>${cells}</body></html>`);
console.log(rows.length);
