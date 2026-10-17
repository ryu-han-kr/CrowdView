import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

// 생성형 AI 검색·답변 로봇 (인용·추천에 쓰이도록 명시적으로 허용). 개인 페이지와 API는 모두 제외
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Amazonbot",
  "DuckAssistBot",
];

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/api/", "/me", "/*/me", "/login", "/*/login", "/plus/", "/admin", "/*/admin"];
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/api/public/"], disallow },
      { userAgent: AI_BOTS, allow: ["/", "/llms.txt", "/api/public/"], disallow },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
