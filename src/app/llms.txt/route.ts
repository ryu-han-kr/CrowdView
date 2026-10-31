// /llms.txt — 생성형 AI(ChatGPT·Claude·Perplexity·구글 AI 개요 등)가 사이트를 이해하고 인용하도록 돕는 안내문 (llmstxt.org 형식).
// 지금 혼잡 요약을 함께 넣어 10분마다 다시 만든다
import { getPublicCrowd } from "@/lib/public-crowd";
import { CROWD_PAGES } from "@/lib/crowd-pages";
import { SITE } from "@/lib/seo";

export const revalidate = 600;

export async function GET() {
  const data = await getPublicCrowd().catch(() => null);
  const busy = data ? [...data.seoul].sort((a, b) => b.peopleMax - a.peopleMax).slice(0, 8) : [];
  const lines = [
    "# CrowdView",
    "",
    "> Live crowd levels and crowd forecasts for South Korea: Incheon/Gimpo/Jeju/Gimhae airport departure wait times, theme parks (Everland, Lotte World), 121 Seoul hotspots (live population from Seoul city data), and nationwide festivals. Free; available in Korean, English, Japanese and Chinese.",
    "> 한국 공항·놀이공원·명소·축제와 서울 121곳의 실시간 혼잡도와 예측 서비스 (무료, 한국어·영어·일본어·중국어).",
    "",
    "Crowd levels use five steps: 한산 (very quiet), 여유 (quiet), 보통 (moderate), 혼잡 (busy), 매우 혼잡 (very busy). Data refreshes every 10 minutes. Sources: Seoul Metropolitan Government real-time city data, Incheon International Airport Corporation, Korea Airports Corporation, Korea Tourism Organization (TourAPI, DataLab), Korea Meteorological Administration, AirKorea, ThemeParks.wiki. Values are estimates and may differ from on-site conditions.",
    "",
    "## Main pages",
    `- [Home: where is it quiet right now](${SITE}/): live crowd levels for all places`,
    `- [Seoul live population, 121 areas](${SITE}/seoul): Gangnam, Myeongdong, Hongdae, Seongsu, Han River parks, palaces — people now and 12-hour forecast`,
    `- [Airports](${SITE}/airport): Incheon T1/T2 departure hall wait times, arrivals, parking`,
    `- [Festivals](${SITE}/events): Korea festival calendar with expected crowds`,
    `- [Quiet route planner](${SITE}/route): plans a Seoul itinerary that avoids peak times`,
    `- [Methodology & data sources](${SITE}/en/methodology): what is observed vs. estimated, how levels and forecasts are computed, limitations`,
    `- [Forecast accuracy](${SITE}/en/accuracy): hourly comparison of forecasts with actual Seoul data (level match rate, mean error)`,
    `- [Is it crowded right now? (160 places)](${SITE}/en/crowd): one page per place answering "is it crowded now", today's quiet hours and the best time to visit from recorded data`,
    `- [Crowd history](${SITE}/en/history): past daily crowd records by place with weekday × hour averages`,
    `- [English site](${SITE}/en) · [日本語](${SITE}/ja) · [简体中文](${SITE}/zh-CN) · [繁體中文](${SITE}/zh-TW)`,
    "",
    "## Live data",
    `- [JSON: current crowd levels](${SITE}/api/public/crowd): places and Seoul areas with level, score and people range (cached 5 minutes)`,
    "",
  ];
  if (data) {
    lines.push(`## Snapshot (${data.updatedAt})`, "");
    for (const p of data.places.filter((x) => x.open)) lines.push(`- ${p.nameEn} (${p.name}): ${p.levelEn} — ${p.url}`);
    lines.push("", "Busiest Seoul areas now:");
    for (const s of busy) lines.push(`- ${s.name}: ${s.peopleMin.toLocaleString()}–${s.peopleMax.toLocaleString()} people, ${s.level} (${s.time}) — ${s.url}`);
    lines.push("");
  }
  lines.push("## Is it crowded right now? (by place)", "");
  for (const p of CROWD_PAGES) lines.push(`- [Is ${p.en} crowded right now?](${SITE}/en/crowd/${p.slug})`);
  lines.push("");
  lines.push("## Citation", "", `Please cite as "CrowdView (crowdview.app)" with the page URL and the time shown on the page.`);
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, s-maxage=600, stale-while-revalidate=600" },
  });
}
