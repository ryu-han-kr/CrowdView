// 과거 이력 백필 공통: 저장소 루트에서 실행 (README: src/data/history/README.md). 원본은 HIST_DIR(기본 .history-raw/, 커밋 안 함)
import fs from "node:fs";
const WT = process.cwd().replaceAll("\\", "/");
export const WTDIR = WT;
export const HIST = (process.env.HIST_DIR ?? `${WT}/.history-raw`).replaceAll("\\", "/");
fs.mkdirSync(HIST, { recursive: true });
for (const line of fs.readFileSync(`${WT}/.env.local`, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 응답 본문에서 키 숨기기
export const redact = (s) => {
  let t = String(s);
  for (const k of [process.env.SEOUL_OPENAPI_KEY, process.env.DATA_GO_KR_KEY]) if (k) t = t.replaceAll(k, "<KEY>").replaceAll(encodeURIComponent(k), "<KEY>");
  return t;
};
export async function get(url, tries = 4, timeout = 60000) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      const t = await r.text();
      if (r.status >= 500 && i < tries) throw new Error("HTTP " + r.status);
      return { status: r.status, text: t, headers: r.headers };
    } catch (e) {
      if (i >= tries) throw new Error(redact(e.message));
      await sleep(2000 * (i + 1));
    }
  }
}
export const seoul = (svc, a, b, ...rest) =>
  `http://openapi.seoul.go.kr:8088/${process.env.SEOUL_OPENAPI_KEY}/json/${svc}/${a}/${b}/${rest.map(encodeURIComponent).join("/")}`;
export const dg = (path, params) =>
  `https://apis.data.go.kr${path}?${new URLSearchParams({ serviceKey: process.env.DATA_GO_KR_KEY, pageNo: "1", numOfRows: "10", ...params })}`;

// KV 집계 (운영 한도 보호에 같이 잡히게)
export async function kvIncr(key, by = 1) {
  const url = process.env.KV_REST_API_URL, tok = process.env.KV_REST_API_TOKEN;
  if (!url) return;
  await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}` },
    body: JSON.stringify([["INCRBY", key, by], ["EXPIRE", key, 40 * 86400, "NX"]]),
  }).catch(() => {});
}
export async function kvGet(key) {
  const r = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } });
  return (await r.json()).result;
}
export const kstDate = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
