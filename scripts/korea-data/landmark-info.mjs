// 대표 명소 66곳 상세 → src/data/korea/landmark-info.json ({ [id]: { overview, addr, tel, homepage, usetime, restdate, parking, images } })
// 한국관광공사 TourAPI KorService2: detailCommon2(개요·주소) + detailIntro2(이용시간·쉬는날) + detailImage2(사진). 실행당 호출 약 200건
// 사용: node scripts/korea-data/landmark-info.mjs  (DATA_GO_KR_KEY: .env.local 또는 환경변수). landmarks.mjs 다음에 실행
import fs from "node:fs";
import path from "node:path";

if (!process.env.DATA_GO_KR_KEY && fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) {
  console.error("DATA_GO_KR_KEY가 없어요");
  process.exit(1);
}

async function call(op, params) {
  const qs = new URLSearchParams({
    serviceKey: KEY,
    MobileOS: "ETC",
    MobileApp: "CrowdView",
    _type: "json",
    numOfRows: "20",
    pageNo: "1",
    ...params,
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://apis.data.go.kr/B551011/KorService2/${op}?${qs}`, { signal: AbortSignal.timeout(15_000) });
      const items = (await res.json()).response?.body?.items?.item;
      return Array.isArray(items) ? items : items ? [items] : [];
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
}

// 관광공사 글에 섞인 HTML 태그·엔티티를 글자로
const clean = (s) =>
  String(s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
const firstUrl = (s) => String(s ?? "").match(/https?:\/\/[^\s"'<>]+/)?.[0];

const landmarks = JSON.parse(fs.readFileSync(path.join("src", "data", "korea", "landmarks.json"), "utf8"));
const out = {};
for (const l of landmarks) {
  const [common] = await call("detailCommon2", { contentId: l.cid });
  if (!common) {
    console.warn(`없음: ${l.n.ko}`);
    continue;
  }
  const [intro] = await call("detailIntro2", { contentId: l.cid, contentTypeId: String(common.contenttypeid) });
  const images = await call("detailImage2", { contentId: l.cid, imageYN: "Y" });
  // 이용시간·쉬는날 필드 이름이 종류마다 다르다 (관광지 12 / 문화시설 14 / 레포츠 28)
  const pick = (...keys) => clean(keys.map((k) => intro?.[k]).find((v) => v && String(v).trim()));
  out[l.id] = {
    // '◎ 한류의 매력…' 같은 덧붙인 홍보 문단은 뺀다
    overview: clean(common.overview)
      .split(/\n?\s*◎/)[0]
      .trim(),
    addr: [clean(common.addr1), clean(common.addr2)].filter(Boolean).join(" "),
    tel: clean(common.tel) || undefined,
    homepage: firstUrl(common.homepage),
    usetime: pick("usetime", "usetimeculture", "usetimeleports") || undefined,
    restdate: pick("restdate", "restdateculture", "restdateleports") || undefined,
    parking: pick("parking", "parkingculture", "parkingleports") || undefined,
    images: images
      .map((i) => String(i.originimgurl ?? "").replace(/^http:/, "https:"))
      .filter((u) => u.startsWith("https://tong.visitkorea.or.kr/"))
      .slice(0, 6),
  };
  console.log(`${l.n.ko}: 개요 ${out[l.id].overview.length}자, 사진 ${out[l.id].images.length}`);
}
fs.writeFileSync(path.join("src", "data", "korea", "landmark-info.json"), JSON.stringify(out));
console.log(`완료 ${Object.keys(out).length}/${landmarks.length}`);
