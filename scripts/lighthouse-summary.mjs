// Lighthouse CI 결과(.lighthouseci/reports/manifest.json)를 표로 바꿔 GitHub Actions 요약에 쓴다
import fs from "node:fs";
const manifest = JSON.parse(fs.readFileSync(".lighthouseci/reports/manifest.json", "utf8"));
const pct = (v) => (v == null ? "-" : `${Math.round(v * 100)}`);
const rows = manifest.map((r) => {
  const s = r.summary;
  return `| ${r.url.replace("https://crowdview.app", "") || "/"} | ${pct(s.performance)} | ${pct(s.accessibility)} | ${pct(s["best-practices"])} | ${pct(s.seo)} |`;
});
const md = ["### Lighthouse (휴대폰 기준, 100점 만점)", "", "| 화면 | 속도 | 접근성 | 권장 사항 | 검색 |", "|---|---|---|---|---|", ...rows].join(
  "\n",
);
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
