// 키-값 캐시. UPSTASH_REDIS_REST_URL 이 있으면 Redis(REST), 없으면 프로세스 메모리.

interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

function memoryKV(): KV {
  const g = globalThis as unknown as { __crowdCache?: Map<string, { v: string; exp: number }> };
  const store = (g.__crowdCache ??= new Map());
  return {
    async get(key) {
      const hit = store.get(key);
      if (!hit || hit.exp < Date.now()) return null;
      return hit.v;
    },
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
    });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    return (await res.json()).result;
  };
  return {
    get: (key) => call(["GET", key]),
    set: async (key, value, ttl) => {
      await call(["SET", key, value, "EX", ttl]);
    },
  };
}

export const kv: KV =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? upstashKV(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN)
    : memoryKV();
