// scripts/i18n/*.mjs 번역 원본 → src/i18n/dict/{en,ja,zh-CN,zh-TW}.ts
// 사용: node scripts/i18n/build.mjs   (코드에 있는데 번역이 빠진 t("…") 키도 알려준다)
import fs from "node:fs";
import path from "node:path";
import places from "./places.mjs";
import ui from "./ui.mjs";

const LANGS = ["en", "ja", "zh-CN", "zh-TW"];
const all = { ...ui, ...places };

for (const [k, v] of Object.entries(all)) {
  if (!Array.isArray(v) || v.length !== 4 || v.some((s) => typeof s !== "string" || !s)) throw new Error(`번역 4개 필요: ${k}`);
  const want = [...k.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  v.forEach((s, i) => {
    const got = [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    if (got !== want) throw new Error(`자리표시자 불일치 (${LANGS[i]}): ${k} → ${s}`);
  });
}

LANGS.forEach((lang, i) => {
  const entries = Object.entries(all).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v[i])},`);
  const src = `// 자동 생성: node scripts/i18n/build.mjs (원본은 scripts/i18n/*.mjs)\nimport type { Dict } from "../translate";\n\nconst dict: Dict = {\n${entries.join("\n")}\n};\n\nexport default dict;\n`;
  fs.writeFileSync(path.join("src/i18n/dict", `${lang}.ts`), src);
});

// 코드의 t("…") 리터럴 중 번역이 없는 것
const missing = new Set();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "dict" && e.name !== "api") walk(p);
    } else if (/\.tsx?$/.test(e.name)) {
      const s = fs.readFileSync(p, "utf8");
      for (const m of s.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) if (/[가-힣]/.test(m[1]) && !all[m[1]]) missing.add(`${m[1]}  (${p})`);
    }
  }
})("src");
console.log(`${Object.keys(all).length}개 항목 → ${LANGS.join(", ")}`);
if (missing.size) console.log(`번역 없음 ${missing.size}개:\n${[...missing].join("\n")}`);
