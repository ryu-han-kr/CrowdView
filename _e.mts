import fs from "node:fs";
for (const line of fs.readFileSync(".env.local","utf8").split(/\r?\n/)) { const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const K = process.env.DATA_GO_KR_KEY!;
const call = (svc: string, op: string, p: Record<string,string>) => fetch(`https://apis.data.go.kr/B551011/${svc}/${op}?` + new URLSearchParams({ serviceKey: K, MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", pageNo: "1", ...p })).then(r => r.json()).then(j => { const i = j.response?.body?.items?.item; return (Array.isArray(i) ? i : i ? [i] : []) as Record<string,string>[]; }).catch(() => []);
const { PLACES } = await import("./src/lib/places.ts");
const lm = JSON.parse(fs.readFileSync("src/data/korea/landmarks.json","utf8"));
const sk = JSON.parse(fs.readFileSync("src/data/korea/spot-kto.json","utf8"));
const targets = [
  ...PLACES.filter(p => !p.kto && p.ktoContent && p.category !== "airport").map(p => ({ id: p.id, cid: String(p.ktoContent!.id), name: p.name })),
  ...lm.filter((l: any) => !sk[l.id]).map((l: any) => ({ id: l.id, cid: l.cid, name: l.n.ko })),
];
const cache = new Map<string, string[]>();
for (const t of targets) {
  const [c] = await call("KorService2", "detailCommon2", { contentId: t.cid });
  if (!c?.lDongRegnCd) { console.log(t.id, "코드 없음"); continue; }
  const sg = c.lDongRegnCd + c.lDongSignguCd;
  if (!cache.has(sg)) cache.set(sg, [...new Set((await call("TatsCnctrRateService", "tatsCnctrRatedList", { areaCd: c.lDongRegnCd, signguCd: sg, numOfRows: "5000" })).map(r => r.tAtsNm))]);
  console.log(`${t.id} (${t.name}) [${sg}] ${cache.get(sg)!.length}곳: ${cache.get(sg)!.join(", ").slice(0, 600)}`);
}
