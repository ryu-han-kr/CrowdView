import { NextResponse } from "next/server";
import { checkAlerts } from "@/lib/alerts";
import { getAllCrowd, refreshAll } from "@/lib/crowd/service";
import { trackAccuracy } from "@/lib/accuracy";
import { opsAlert } from "@/lib/ops";
import { getAllSeoulLive } from "@/lib/seoul-live";
import { chargeDue, expireEnded, sendRenewalNotices } from "@/lib/plus";
import { addDays, kst } from "@/lib/time";
import { PLACES } from "@/lib/places";
import { summarizeDay } from "@/lib/crowd/history";
import { checkTripWatches } from "@/lib/trip-watch";
import { flushReports } from "@/lib/crowd-report";
import { updateBiases } from "@/lib/crowd/bias";
import { learnable, recordCalibration, type Sample } from "@/lib/crowd/calibration";
import { expectedScore } from "@/lib/crowd/model";
import { getSignals } from "@/lib/crowd/signals";
import { getLivePlaces } from "@/lib/place-info";
import { updateWeekRatios } from "@/lib/region-visitors";
import type { CrowdResult } from "@/lib/types";

/** 실측이 들어온 장소마다 '모델만 냈을 점수'·'보정한 모델 점수'·실제 점수 (lib/crowd/calibration) */
async function calibrationSamples(crowd: Record<string, CrowdResult>): Promise<Sample[]> {
  const places = (await getLivePlaces()).filter((p) => crowd[p.id] && learnable(crowd[p.id]));
  return Promise.all(
    places.map(async (place) => {
      const s = await getSignals(place).catch(() => ({}) as Awaited<ReturnType<typeof getSignals>>);
      const t = kst(new Date(crowd[place.id].updatedAt));
      return {
        place,
        t,
        holidays: s.holidays,
        raw: expectedScore(place, t, { ...s, calib: undefined }),
        cal: expectedScore(place, t, s),
        actual: crowd[place.id].score,
      };
    }),
  );
}

// Vercel Cron(vercel.json, 10분마다, GET)이 Authorization: Bearer CRON_SECRET 헤더로 호출한다.
// 다른 클라우드로 옮기면 그쪽 스케줄러가 같은 헤더를 붙여 GET 또는 POST로 부르면 된다
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  // 운영에서 비밀값이 빠지면 막는다 (누구나 수집·결제 실행을 부를 수 있게 되므로). 로컬은 비밀값 없이 실행 가능
  if ((secret || process.env.VERCEL_ENV === "production") && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const refreshed = await refreshAll();
  // 새 혼잡도로 Plus 혼잡 알림을 보내고, 기간이 끝난 해지 구독을 정리한다 (DB가 없으면 건너뜀)
  const alerts = await checkAlerts(await getAllCrowd()).catch(async (e) => (await opsAlert("혼잡 알림 발송 실패", e), 0));
  // 만료 정리·자동결제 7일 전 안내는 하루 한 번 (새벽 4시 첫 수집)이면 충분 — 매번 돌리면 DB가 계속 깨어 있다
  const now = kst();
  const daily = Math.floor(now.hour) === 4 && (now.hour % 1) * 60 < 10;
  // Plus 자동결제: 결제일이 된 구독을 결제한다 (토스는 예약 결제가 없어서 우리가 돌린다. 대상이 없으면 DB 조회 1번)
  const charged = await chargeDue().catch(async (e) => (await opsAlert("Plus 자동결제 실행 실패", e), 0));
  const expired = daily ? await expireEnded().catch(async (e) => (await opsAlert("구독 만료 정리 실패", e), 0)) : 0;
  // 예측 정확도: 매시 정각 첫 수집 때 채점·새 예측 저장 (서울 121곳, Redis)
  const hourly = (now.hour % 1) * 60 < 10;
  const scored = hourly ? await trackAccuracy(await getAllSeoulLive()).catch(async (e) => (await opsAlert("예측 정확도 기록 실패", e), 0)) : 0;
  // 실측과 비교해 예측 모델 고치기: 매시 정각 첫 수집 때 실측 장소마다 모델 오차를 쌓고 보정 칸을 갱신 (Redis)
  const calibrated = hourly
    ? await recordCalibration(await calibrationSamples(await getAllCrowd())).catch(async (e) => (await opsAlert("모델 보정 기록 실패", e), 0))
    : 0;
  // 시군구 주말/평일 방문객 비 (데이터랩, 명소 예측의 주말 배율)
  const weekRatios = daily ? await updateWeekRatios().catch(async (e) => (await opsAlert("주말 배율 계산 실패", e), 0)) : 0;
  // 어제 실측 기록을 하루 요약으로 (요일별·월별 실측 평균용, Redis)
  const summarized = daily
    ? (await Promise.all(PLACES.map((p) => summarizeDay(p.id, addDays(now.date, -1)).catch(() => false)))).filter(Boolean).length
    : 0;
  // 어제 방문자 제보를 DB에 한 번에 (정확도 점검용)
  const reports = daily ? await flushReports(addDays(now.date, -1)).catch(async (e) => (await opsAlert("제보 저장 실패", e), 0)) : 0;
  // 제보로 장소별 보정값 다시 계산 (예측·추정 값에만 쓰인다)
  const biased = daily ? await updateBiases(PLACES).catch(async (e) => (await opsAlert("제보 보정 계산 실패", e), 0)) : 0;
  // 여행 날짜 알림 (Plus): 아침 9시 첫 수집 때 한 번 (새벽에 깨우지 않게)
  const morning = Math.floor(now.hour) === 9 && (now.hour % 1) * 60 < 10;
  const trips = morning ? await checkTripWatches().catch(async (e) => (await opsAlert("여행 날짜 알림 실패", e), 0)) : 0;
  const notices = daily ? await sendRenewalNotices().catch(async (e) => (await opsAlert("자동결제 안내 실패", e), 0)) : 0;
  // 실시간 원본 중 40분 넘게 안 바뀐 곳이 있으면 그 원본이 멈춘 것 (화면엔 '갱신 지연'으로 보인다)
  // 문을 닫은 곳(밤 공항 등)은 원본이 비는 게 정상이라 뺀다. 같은 곳들이 계속 밀리면 3시간에 한 번만 알린다
  const staleEntries = Object.entries(await getAllCrowd()).filter(([, c]) => c.source !== "model" && c.open && c.ageMinutes > 40);
  if (staleEntries.length)
    await opsAlert(
      `실시간 데이터 갱신 지연 ${staleEntries.length}곳`,
      staleEntries.map(([id, c]) => `${id}(${c.source} ${c.ageMinutes}분)`).join(", "),
      {
        key: `stale:${staleEntries
          .map(([id]) => id)
          .sort()
          .join(",")}`,
        cooldownS: 3 * 3600,
      },
    );
  // 실시간 원본이 하나도 안 들어오면(전부 예측값) 원본 API·키 장애일 가능성이 크다
  if (refreshed.length && refreshed.every((r) => r.source === "model")) await opsAlert(`실시간 수집 전체 실패 (${refreshed.length}곳 모두 예측값)`);
  return NextResponse.json({ refreshed, alerts, charged, expired, notices, scored, calibrated, weekRatios, summarized, trips, reports, biased });
}

export const POST = GET;
