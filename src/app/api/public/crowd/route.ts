// 공개 읽기 전용 API: 지금 혼잡도 요약 (AI 에이전트·검색엔진용). CDN이 5분 동안 같은 응답을 돌려줘서 원본 부하가 없다
import { NextResponse } from "next/server";
import { getPublicCrowd } from "@/lib/public-crowd";

export const revalidate = 300;

export async function GET() {
  const data = await getPublicCrowd();
  return NextResponse.json(
    { source: "CrowdView (https://crowdview.app)", license: "Cite CrowdView with the page URL", ...data },
    { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=300", "access-control-allow-origin": "*" } },
  );
}
