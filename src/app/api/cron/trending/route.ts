// 요즘 뜨는 곳 계산 (lib/trending). 매시 15분에 불려 오늘 계산이 아직이면(6시 이후) 계산한다.
// AI 웹 검색이 몇 분 걸릴 수 있어 5분 수집기와 따로 둔다
import { NextResponse } from "next/server";
import { dataGoKr } from "@/lib/datagokr";
import { opsAlert } from "@/lib/ops";
import { kst } from "@/lib/time";
import { refreshTrending, trendingDue } from "@/lib/trending";

export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if ((secret || process.env.VERCEL_ENV === "production") && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // 관광공사 사진 API를 하루 한 번 실제로 부른다 (10/30: 운영계정 신청이 '호출 이력 없음'으로 반려 → 이력을 쌓고 다시 신청).
  // 23시간 캐시라 매시 불려도 원본은 하루 한 번. 공모전 수상작·관광사진 갤러리 최신 목록
  const KTO = { MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", numOfRows: "100", pageNo: "1" };
  await Promise.all([
    dataGoKr("/B551011/PhokoAwrdService/phokoAwrdList", KTO, 23 * 3600).catch(() => []),
    dataGoKr("/B551011/PhotoGalleryService1/galleryList1", { ...KTO, arrange: "C" }, 23 * 3600).catch(() => []),
  ]);
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && !(await trendingDue(kst().hour))) return NextResponse.json({ skipped: true });
  const n = await refreshTrending().catch(async (e) => (await opsAlert("요즘 뜨는 곳 계산 실패", e, { key: "trending", cooldownS: 6 * 3600 }), 0));
  return NextResponse.json({ items: n });
}
