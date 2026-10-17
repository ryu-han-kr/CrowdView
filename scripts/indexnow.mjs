// IndexNow: 사이트맵의 주소를 Bing·네이버 등 IndexNow 참여 검색엔진에 바로 알린다 (무료, 키 파일은 public/{키}.txt).
// 사용: node scripts/indexnow.mjs            → 사이트맵 전체 (주 1회 GitHub Actions)
//       node scripts/indexnow.mjs /spot/x …  → 지정한 주소만
import fs from "node:fs";

const SITE = "https://crowdview.app";
const key = fs.readdirSync("public").find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, 32);
if (!key) {
  console.error("public/{32자리 키}.txt 가 없어요");
  process.exit(1);
}

let urls = process.argv.slice(2).map((p) => (p.startsWith("http") ? p : `${SITE}${p}`));
if (!urls.length) {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}
console.log(`알릴 주소 ${urls.length}개`);

// api.indexnow.org 는 받은 내용을 참여 검색엔진(Bing·Yandex 등)과 나눈다. 네이버는 따로도 보낸다
const ENDPOINTS = ["https://api.indexnow.org/indexnow", "https://searchadvisor.naver.com/indexnow"];
for (const endpoint of ENDPOINTS) {
  for (let i = 0; i < urls.length; i += 10_000) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: "crowdview.app", key, keyLocation: `${SITE}/${key}.txt`, urlList: urls.slice(i, i + 10_000) }),
    }).catch((e) => ({ status: 0, statusText: String(e) }));
    console.log(endpoint, res.status, res.statusText ?? "");
  }
}
