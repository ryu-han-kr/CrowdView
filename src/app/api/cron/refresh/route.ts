import { NextResponse } from "next/server";
import { checkAlerts } from "@/lib/alerts";
import { getAllCrowd, refreshAll } from "@/lib/crowd/service";
import { trackAccuracy } from "@/lib/accuracy";
import { opsAlert } from "@/lib/ops";
import { getAllSeoulLive } from "@/lib/seoul-live";
import { expireEnded, sendRenewalNotices } from "@/lib/plus";
import { kst } from "@/lib/time";

// Vercel Cron(vercel.json, 10분마다, GET)이 Authorization: Bearer CRON_SECRET 헤더로 호출한다.
// 다른 클라우드로 옮기면 그쪽 스케줄러가 같은 헤더를 붙여 GET 또는 POST로 부르면 된다
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const refreshed = await refreshAll();
  // 새 혼잡도로 Plus 혼잡 알림을 보내고, 기간이 끝난 해지 구독을 정리한다 (DB가 없으면 건너뜀)
  const alerts = await checkAlerts(await getAllCrowd()).catch(async (e) => (await opsAlert("혼잡 알림 발송 실패", e), 0));
  // 만료 정리·자동결제 7일 전 안내는 하루 한 번 (새벽 4시 첫 수집)이면 충분 — 매번 돌리면 DB가 계속 깨어 있다
  const now = kst();
  const daily = Math.floor(now.hour) === 4 && (now.hour % 1) * 60 < 10;
  const expired = daily ? await expireEnded().catch(async (e) => (await opsAlert("구독 만료 정리 실패", e), 0)) : 0;
  // 예측 정확도: 매시 정각 첫 수집 때 채점·새 예측 저장 (서울 119곳, Redis)
  const hourly = (now.hour % 1) * 60 < 10;
  const scored = hourly ? await trackAccuracy(await getAllSeoulLive()).catch(async (e) => (await opsAlert("예측 정확도 기록 실패", e), 0)) : 0;
  const notices = daily ? await sendRenewalNotices().catch(async (e) => (await opsAlert("자동결제 안내 실패", e), 0)) : 0;
  // 실시간 원본 중 40분 넘게 안 바뀐 곳이 있으면 그 원본이 멈춘 것 (화면엔 '갱신 지연'으로 보인다)
  // 문을 닫은 곳(밤 공항 등)은 원본이 비는 게 정상이라 뺀다. 같은 곳들이 계속 밀리면 3시간에 한 번만 알린다
  const staleEntries = Object.entries(await getAllCrowd()).filter(([, c]) => c.source !== "model" && c.open && c.ageMinutes > 40);
  if (staleEntries.length)
    await opsAlert(
      `실시간 데이터 갱신 지연 ${staleEntries.length}곳`,
      staleEntries.map(([id, c]) => `${id}(${c.source} ${c.ageMinutes}분)`).join(", "),
      { key: `stale:${staleEntries.map(([id]) => id).sort().join(",")}`, cooldownS: 3 * 3600 },
    );
  // 실시간 원본이 하나도 안 들어오면(전부 예측값) 원본 API·키 장애일 가능성이 크다
  if (refreshed.length && refreshed.every((r) => r.source === "model")) await opsAlert(`실시간 수집 전체 실패 (${refreshed.length}곳 모두 예측값)`);
  return NextResponse.json({ refreshed, alerts, expired, notices, scored });
}

export const POST = GET;
