// 장소별 혼잡 관련 사실 모으기 (경수님 10/31 'API 크레딧 남은 걸로 혼잡도 데이터 싹 긁어'). Claude + 웹 검색으로
// 연간 방문객·수용 인원·붐비는 달/요일/시간·한산한 때·운영 시간·휴무·예약·혼잡 원인(축제·벚꽃 등)을 출처와 함께 모은다.
// 원문 그대로 Redis(rsch:{id}, 1년)에 둔다 — 예측 모델(인기도·피크 시각·운영 시간·성수기)에 쓰는 건 사람이 검토해 다듬은 뒤
// 손으로 부르는 일: api/cron/place-research. 실측이 아니라 '공개된 통계·안내'라서 confidence를 같이 받는다
import Anthropic from "@anthropic-ai/sdk";
import { aiCreate } from "./ai-quota";
import { kv } from "./cache";
import landmarks from "../data/korea/landmarks.json";
import { SEOUL_AREAS } from "./seoul-areas";
import { PLACES } from "./places";

const KEEP = 365 * 86_400;
export const researchKey = (id: string) => `rsch:${id}`;

export interface ResearchTarget {
  id: string;
  name: string;
  kind: string;
  address: string;
}

/** 모을 대상: 장소(행사 제외) + 서울시 실시간 121곳 + 전국 명소 (landmarks.json) */
export function researchTargets(): ResearchTarget[] {
  const places = PLACES.filter((p) => p.category !== "event").map((p) => ({ id: p.id, name: p.name, kind: p.category, address: p.address }));
  const areas = SEOUL_AREAS.map((a) => ({ id: `seoul-${a.code}`, name: a.name, kind: "seoul-area", address: "서울" }));
  const lms = (landmarks as { id: string; region: string; kind: string; n: { ko: string } }[]).map((l) => ({ id: `lm-${l.id}`, name: l.n.ko, kind: l.kind, address: l.region }));
  return [...places, ...areas, ...lms];
}

const SYSTEM = `너는 한국 관광지 혼잡도 데이터 조사원이다. 한 장소가 언제 얼마나 붐비는지에 대한 공개된 사실을 웹 검색으로 모은다.
우선 출처: 문화체육관광부·한국문화관광연구원 '주요관광지점 입장객 통계', 한국관광공사·데이터랩, 지자체 통계·보도자료, 공식 사이트, 언론 기사, 최근 방문 후기(블로그·커뮤니티)의 대기·혼잡 언급.
숫자는 출처와 연도를 붙이고, 확인되지 않은 것은 null로 둔다. 지어내지 않는다. 후기에서 나온 경향은 그렇다고 적는다.`;

function prompt(t: ResearchTarget, today: string) {
  return `오늘은 ${today}이다. 아래 장소의 혼잡 관련 사실을 조사하라.
장소: ${t.name} (${t.kind}) / 주소: ${t.address}

과거 기록도 찾는다 (연도별·월별 입장객, 역대 최다 인파 날, 입장 제한·매진 기록).
검색할 것: "${t.name} 입장객 수"·"${t.name} 연간 방문객 통계"·"${t.name} 방문객"·"${t.name} 혼잡"·"${t.name} 대기시간"·"${t.name} 사람 많은 시간"·운영 시간·휴무일.
마지막 답은 다른 말 없이 아래 모양의 JSON 하나만 쓴다 (모르면 null 또는 빈 배열):
{"annualVisitors":[{"year":연도,"count":숫자,"source":"출처"}] (찾을 수 있는 만큼 여러 해, 최근 5~10년),
"monthlyVisitors":[{"month":"YYYY-MM","count":숫자}] (과거 월별 통계가 있으면 전부),
"pastPeaks":[{"date":"YYYY-MM-DD 또는 기간","count":숫자|null,"what":"예: 2025 어린이날 입장 제한"}],
"dailyPeak":{"count":숫자,"note":"예: 어린이날 하루 최다"}|null,
"capacity":{"count":숫자,"note":"수용 인원·동시 입장 제한·좌석 등"}|null,
"peakMonths":[1~12],"quietMonths":[1~12],
"busiestDays":["mon|tue|wed|thu|fri|sat|sun|holiday"],"quietestDays":["..."],
"busiestHours":[[시작시,끝시]],"quietHours":[[시작시,끝시]],
"weekendVsWeekday":숫자|null,
"hours":{"mon":[여는시,닫는시]|null,"tue":...,"wed":...,"thu":...,"fri":...,"sat":...,"sun":...}|null,
"closed":"정기 휴무·명절 휴무 (원문 요약)",
"reservation":"required|recommended|none|unknown",
"avgStayMinutes":숫자|null,
"waitNotes":["대기 시간 언급 (예: 주말 인기 기구 90분)"],
"crowdTriggers":[{"what":"벚꽃·축제·방학·신상 오픈 등","when":"시기"}],
"tips":["한산하게 가는 법 2~4개"],
"trend":"최근 방문객 증감 한 줄",
"sources":["URL"],
"confidence":"high|medium|low"}`;
}

/** 답에서 JSON을 꺼낸다 (모양은 느슨하게 두고 원문 보관) */
export function parseResearch(text: string): Record<string, unknown> | undefined {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return undefined;
  try {
    const x = JSON.parse(m[0]);
    return x && typeof x === "object" ? (x as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** 한 곳 조사 → 저장. 이미 있으면 건너뛴다 (force면 다시) */
export async function research(t: ResearchTarget, today: string, force = false): Promise<"cached" | "ok" | "fail"> {
  if (!force && (await kv.get(researchKey(t.id)).catch(() => null))) return "cached";
  const client = new Anthropic({ timeout: 240_000 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt(t, today) }];
  for (let turn = 0; turn < 3; turn++) {
    const res = await aiCreate(client, {
      model: "claude-sonnet-5-5",
      max_tokens: 6000,
      system: SYSTEM,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6, user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" } }],
      messages,
    });
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") return "fail";
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const data = parseResearch(text);
    if (!data) return "fail";
    await kv.set(researchKey(t.id), JSON.stringify({ ...data, name: t.name, kind: t.kind, at: today }), KEEP).catch(() => {});
    return "ok";
  }
  return "fail";
}
