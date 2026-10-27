// 혼잡도 지도 첫 그림(정적 미리보기) 만들기 → public/map/korea.webp
// 사용: npx tsx scripts/map-preview/build.mts
// 네이버 지도 타일이 LCP(7~8초)라 그 전에 보일 한반도 남쪽 실루엣. 투영은 src/lib/map-preview.ts 와 같다 (핀 자리가 맞아야 한다)
// 지도 자료: southkorea/southkorea-maps (통계청 2013 시도 경계, 단순화) — skorea-provinces.json
import fs from "node:fs";
import sharp from "sharp";
const { MAP_PREVIEW_H, MAP_PREVIEW_W, projectToPreview } =
  await import("../../src/lib/map-preview.ts");

type Ring = [number, number][];
const geo = JSON.parse(
  fs.readFileSync(new URL("./skorea-provinces.json", import.meta.url), "utf8"),
) as {
  features: {
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: Ring[] | Ring[][];
    };
  }[];
};

const SEA = "#e9f0fa";
const LAND = "#ffffff";
const BORDER = "#cfd9e8";

const ringPath = (ring: Ring) =>
  ring
    .map(([lng, lat], i) => {
      const [x, y] = projectToPreview(lat, lng);
      return `${i ? "L" : "M"}${x} ${y}`;
    })
    .join("") + "Z";

const paths: string[] = [];
for (const f of geo.features) {
  const polys =
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates as Ring[]]
      : (f.geometry.coordinates as Ring[][]);
  for (const poly of polys) paths.push(poly.map(ringPath).join(""));
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_PREVIEW_W}" height="${MAP_PREVIEW_H}" viewBox="0 0 ${MAP_PREVIEW_W} ${MAP_PREVIEW_H}">
<rect width="100%" height="100%" fill="${SEA}"/>
<g fill="${LAND}" stroke="${BORDER}" stroke-width="1.5" stroke-linejoin="round" fill-rule="evenodd">
${paths.map((d) => `<path d="${d}"/>`).join("\n")}
</g>
</svg>`;

fs.mkdirSync("public/map", { recursive: true });
const out = "public/map/korea.webp";
await sharp(Buffer.from(svg)).webp({ quality: 82, effort: 6 }).toFile(out);
console.log(
  `${out} ${MAP_PREVIEW_W}×${MAP_PREVIEW_H} ${fs.statSync(out).size}B`,
);
