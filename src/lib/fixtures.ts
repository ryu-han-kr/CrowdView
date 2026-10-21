// 고정 자료 모드 (QA 10/21 명세 5.5): 공공데이터를 부르지 않고 tests/fixtures/<상황>/ 의 JSON을 돌려준다.
// DATA_FIXTURES=normal | stale | invalid | empty | timeout. 로컬·CI 시험 전용 — Vercel(운영·미리보기)에서는 켜지지 않는다.
// 자료 안의 "@now", "@now-180m", "@now+60m" 같은 값은 그 시각(한국 시간 "YYYY-MM-DD HH:mm")으로 바꿔서, 언제 돌려도 '방금' 또는 '3시간 전' 자료가 된다

export type FixtureScenario = "normal" | "stale" | "invalid" | "empty" | "timeout";

/** 켜져 있으면 상황 이름 */
export function fixtureMode(): FixtureScenario | undefined {
  if (process.env.VERCEL) return undefined;
  const v = process.env.DATA_FIXTURES;
  return v === "normal" || v === "stale" || v === "invalid" || v === "empty" || v === "timeout" ? v : undefined;
}

/** 지금에서 offsetMin분 뒤 한국 시각 문자열 (음수면 전) */
function kstStamp(offsetMin: number, now = Date.now()): string {
  return new Date(now + 9 * 3600_000 + offsetMin * 60_000).toISOString().slice(0, 16).replace("T", " ");
}

function resolveTimes(v: unknown, now: number): unknown {
  if (typeof v === "string") {
    // "@now", "@now-30m"(30분 전), "@now+60m"(1시간 뒤)
    const m = v.match(/^@now(?:([+-])(\d+)m)?$/);
    return m ? kstStamp((m[1] === "-" ? -1 : 1) * Number(m[2] ?? 0), now) : v;
  }
  if (Array.isArray(v)) return v.map((x) => resolveTimes(x, now));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveTimes(x, now)]));
  return v;
}

/**
 * 상황 폴더의 자료 하나. 없으면 undefined (그 API는 '키 없음'과 같게 동작).
 * timeout 상황은 원본이 응답하지 않는 것처럼 오류를 던진다
 */
export function loadFixture<T = unknown>(name: string, now = Date.now()): T | undefined {
  const scenario = fixtureMode();
  if (!scenario) return undefined;
  if (scenario === "timeout") throw new Error(`fixture timeout: ${name}`);
  // node:fs를 위에서 import하면 이 파일을 거쳐 가는 브라우저 묶음(축제 목록 등)이 빌드되지 않는다 → 서버에서 쓸 때만 꺼낸다
  const fs = process.getBuiltinModule("node:fs") as typeof import("node:fs");
  const file = `${process.cwd()}/tests/fixtures/${scenario}/${name}.json`;
  if (!fs.existsSync(file)) return undefined;
  return resolveTimes(JSON.parse(fs.readFileSync(file, "utf8")), now) as T;
}

/** 공공데이터포털 경로 → 자료 파일 이름 (/B551177/StatusOfParking/getTrackingParking → datagokr_B551177_StatusOfParking_getTrackingParking) */
export const dataGoKrFixtureName = (apiPath: string) => `datagokr${apiPath.replaceAll("/", "_")}`;
