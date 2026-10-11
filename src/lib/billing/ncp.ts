// NAVER Cloud Platform 비용·사용량 API (Cost and Usage).
// 지도용 Client ID/Secret이 아니라 계정 API 인증키(NCP_ACCESS_KEY / NCP_SECRET_KEY)로 서명한다.
import { createHmac } from "node:crypto";

const HOST = "https://billingapi.apigw.ntruss.com";

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const accessKey = process.env.NCP_ACCESS_KEY;
  const secretKey = process.env.NCP_SECRET_KEY;
  if (!accessKey || !secretKey) throw new Error("NCP_ACCESS_KEY / NCP_SECRET_KEY 미설정");

  const uri = `${path}?${new URLSearchParams({ ...params, responseFormatType: "json" })}`;
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secretKey).update(`GET ${uri}\n${timestamp}\n${accessKey}`).digest("base64");
  const res = await fetch(HOST + uri, {
    headers: {
      "x-ncp-apigw-timestamp": timestamp,
      "x-ncp-iam-access-key": accessKey,
      "x-ncp-apigw-signature-v2": signature,
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`NCP ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  code: string; // MPDNM_MAPS 등
  name: string; // Dynamic Map 등
  quantity: number;
  unit: string;
}

interface UsageRow {
  useDate: { useStartDate: string };
  usage: { meteringType: { code: string; codeName: string }; userUsageQuantity: number; userUnit: { codeName: string } };
}

// 일별 사용량. 날짜는 YYYYMMDD, 최대 3개월 범위
export async function getDailyUsage(startDay: string, endDay: string): Promise<DailyUsage[]> {
  const rows: DailyUsage[] = [];
  for (let pageNo = 1; ; pageNo++) {
    const json = await call<{
      getContractUsageListByDailyResponse: { totalRows: number; contractUsageListByDaily: UsageRow[] };
    }>("/billing/v1/cost/getContractUsageListByDaily", {
      useStartDay: startDay,
      useEndDay: endDay,
      pageNo: String(pageNo),
      pageSize: "1000",
    });
    const { totalRows, contractUsageListByDaily: list = [] } = json.getContractUsageListByDailyResponse;
    for (const r of list) {
      rows.push({
        date: r.useDate.useStartDate.slice(0, 10),
        code: r.usage.meteringType.code,
        name: r.usage.meteringType.codeName,
        quantity: r.usage.userUsageQuantity,
        unit: r.usage.userUnit.codeName,
      });
    }
    if (list.length === 0 || rows.length >= totalRows) return rows;
  }
}

// 해당 월의 청구 금액 (원, VAT 포함). 월이 끝나기 전에는 그때까지 확정된 금액
export async function getMonthDemand(month: string): Promise<number> {
  const json = await call<{
    getDemandCostListResponse: { demandCostList: { thisMonthAmountIncludingVat: number }[] };
  }>("/billing/v1/cost/getDemandCostList", { startMonth: month, endMonth: month });
  return json.getDemandCostListResponse.demandCostList.reduce((s, d) => s + d.thisMonthAmountIncludingVat, 0);
}
