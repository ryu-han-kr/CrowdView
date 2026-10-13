// 공공데이터포털(apis.data.go.kr) 공통 호출. DATA_GO_KR_KEY 하나로 활용신청한 API를 모두 쓴다.
const BASE = "https://apis.data.go.kr";

export type Item = Record<string, string | number | undefined>;

/**
 * items 배열을 돌려준다. 응답 형식 파라미터(type, _type, dataType)는 API마다 달라 호출부에서 넘긴다.
 * revalidate(초)를 주면 Next Data Cache에 그만큼 저장한다. 주지 않으면 매번 호출한다.
 * cache: "no-store"는 쓰지 않는다 (ISR 페이지에서 정적 렌더링이 깨진다).
 */
export async function dataGoKr(path: string, params: Record<string, string>, revalidate?: number): Promise<Item[]> {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error("DATA_GO_KR_KEY 미설정");
  const qs = new URLSearchParams({ serviceKey: key, pageNo: "1", numOfRows: "100", ...params });
  const res = await fetch(`${BASE}${path}?${qs}`, {
    signal: AbortSignal.timeout(8000),
    ...(revalidate ? { next: { revalidate } } : {}),
  });
  const text = await res.text();
  // 활용신청 전이면 403 + SERVICE_KEY_IS_NOT_REGISTERED_ERROR
  const errMsg = text.match(/"errMsg":\s*"([^"]+)"/)?.[1];
  if (!res.ok || errMsg) throw new Error(`${path} ${res.status}: ${errMsg ?? text.slice(0, 80)}`);
  let json: { response?: { body?: unknown }; body?: unknown };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${path}: non-JSON response ${text.slice(0, 120)}`);
  }
  const body = (json.response?.body ?? json.body) as { items?: { item?: Item | Item[] } | Item[] | "" } | undefined;
  if (!body) throw new Error(`${path}: unexpected payload`);
  const items = body.items;
  if (!items) return [];
  const item = Array.isArray(items) ? items : items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

/** YYYY-MM-DD → YYYYMMDD */
export const ymd = (date: string) => date.replaceAll("-", "");
