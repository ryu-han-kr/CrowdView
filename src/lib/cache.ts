// 키-값 캐시. Upstash Redis(REST)가 연결돼 있으면 Redis, 없으면 프로세스 메모리.
// Vercel Storage로 만들면 KV_REST_API_URL/TOKEN, Upstash 콘솔에서 직접 만들면 UPSTASH_REDIS_REST_URL/TOKEN 이름으로 들어온다.

interface KV {
  get(key: string): Promise<string | null>;
  /** 여러 키를 명령 1번으로 읽는다 (무료 한도: 월 50만 명령) */
  mget(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

function memoryKV(): KV {
  const g = globalThis as unknown as { __crowdCache?: Map<string, { v: string; exp: number }> };
  const store = (g.__crowdCache ??= new Map());
  const get = async (key: string) => {
    const hit = store.get(key);
    if (!hit || hit.exp < Date.now()) return null;
    return hit.v;
  };
  return {
    get,
    mget: (keys) => Promise.all(keys.map(get)),
    async set(key, v, ttl) {
      store.set(key, { v, exp: Date.now() + ttl * 1000 });
    },
  };
}

function upstashKV(url: string, token: string): KV {
  const call = async (command: (string | number)[]) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      // POST라 Data Cache에 저장되지 않는다. "no-store"를 주면 ISR 페이지가 동적 렌더링으로 바뀌어 에러가 난다
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    return (await res.json()).result;
  };
  return {
    get: (key) => call(["GET", key]),
    mget: async (keys) => (keys.length ? call(["MGET", ...keys]) : []),
    set: async (key, value, ttl) => {
      await call(["SET", key, value, "EX", ttl]);
    },
  };
}

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const kv: KV = url && token ? upstashKV(url, token) : memoryKV();
export const kvBackend = url && token ? "redis" : "memory";
