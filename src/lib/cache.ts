// 키-값 캐시. Upstash Redis(REST)가 연결돼 있으면 Redis, 없으면 프로세스 메모리.
// Vercel Storage로 만들면 KV_REST_API_URL/TOKEN, Upstash 콘솔에서 직접 만들면 UPSTASH_REDIS_REST_URL/TOKEN 이름으로 들어온다.

interface KV {
  get(key: string): Promise<string | null>;
  /** 여러 키를 명령 1번으로 읽는다 (무료 한도: 월 50만 명령) */
  mget(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** 키가 없을 때만 저장 (분산 잠금용). 저장했으면 true */
  setNX(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  /** 1 올리고 새 값을 돌려준다. 처음 만들 때만 만료 시간을 건다 (API 호출 수 집계용) */
  incr(key: string, ttlSeconds: number): Promise<number>;
  decr(key: string): Promise<number>;
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
    async setNX(key, v, ttl) {
      if (await get(key)) return false;
      store.set(key, { v, exp: Date.now() + ttl * 1000 });
      return true;
    },
    async incr(key, ttl) {
      const hit = store.get(key);
      const live = hit && hit.exp >= Date.now();
      const n = (live ? Number(hit.v) : 0) + 1;
      store.set(key, { v: String(n), exp: live ? hit.exp : Date.now() + ttl * 1000 });
      return n;
    },
    async decr(key) {
      const hit = store.get(key);
      const n = (hit ? Number(hit.v) : 0) - 1;
      store.set(key, { v: String(n), exp: hit?.exp ?? Date.now() + 86_400_000 });
      return n;
    },
  };
}

function upstashKV(url: string, token: string): KV {
  // unique: 페이지 정적 생성 중 Next.js는 같은 요청(같은 body)을 한 번만 보내고 결과를 재사용한다.
  // INCR처럼 매번 실행돼야 하는 명령은 요청마다 다른 헤더를 붙여 재사용을 막는다
  const call = async (command: (string | number)[], unique = false) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...(unique ? { "X-Request-Id": crypto.randomUUID() } : {}) },
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
      await call(["SET", key, value, "EX", ttl], true);
    },
    setNX: async (key, value, ttl) => (await call(["SET", key, value, "NX", "EX", ttl], true)) === "OK",
    incr: async (key, ttl) => {
      const n = Number(await call(["INCR", key], true));
      if (n === 1) await call(["EXPIRE", key, ttl], true);
      return n;
    },
    decr: async (key) => Number(await call(["DECR", key], true)),
  };
}

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const kv: KV = url && token ? upstashKV(url, token) : memoryKV();
export const kvBackend = url && token ? "redis" : "memory";
