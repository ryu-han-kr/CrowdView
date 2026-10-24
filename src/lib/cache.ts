// 키-값 캐시. Upstash Redis(REST)가 연결돼 있으면 Redis, 없으면 프로세스 메모리.
// Vercel Storage로 만들면 KV_REST_API_URL/TOKEN, Upstash 콘솔에서 직접 만들면 UPSTASH_REDIS_REST_URL/TOKEN 이름으로 들어온다.

interface KV {
  get(key: string): Promise<string | null>;
  /** 여러 키를 명령 1번으로 읽는다 (무료 한도: 월 50만 명령) */
  mget(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** 키가 없을 때만 저장 (분산 잠금용). 저장했으면 true */
  setNX(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  /** by(기본 1)만큼 올리고 새 값을 돌려준다. 처음 만들 때만 만료 시간을 건다 (API 호출 수 집계용) */
  incr(key: string, ttlSeconds: number, by?: number): Promise<number>;
  decr(key: string, by?: number): Promise<number>;
  /**
   * 여러 명령을 요청 1번에 (Upstash pipeline). 메모리 모드는 이용 집계(lib/traffic)에 쓰는 HINCRBY·HGETALL·PFADD·PFCOUNT·EXPIRE만 흉내 낸다
   */
  pipeline(commands: (string | number)[][]): Promise<unknown[]>;
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
      // await 없이 확인·저장해야 동시에 들어온 요청 중 하나만 잡는다
      const hit = store.get(key);
      if (hit && hit.exp >= Date.now()) return false;
      store.set(key, { v, exp: Date.now() + ttl * 1000 });
      return true;
    },
    async incr(key, ttl, by = 1) {
      const hit = store.get(key);
      const live = hit && hit.exp >= Date.now();
      const n = (live ? Number(hit.v) : 0) + by;
      store.set(key, { v: String(n), exp: live ? hit.exp : Date.now() + ttl * 1000 });
      return n;
    },
    async decr(key, by = 1) {
      const hit = store.get(key);
      const n = (hit ? Number(hit.v) : 0) - by;
      store.set(key, { v: String(n), exp: hit?.exp ?? Date.now() + 86_400_000 });
      return n;
    },
    async pipeline(commands) {
      const m = globalThis as unknown as { __crowdHash?: Map<string, Map<string, number>>; __crowdSet?: Map<string, Set<string>> };
      const hashes = (m.__crowdHash ??= new Map());
      const sets = (m.__crowdSet ??= new Map());
      return commands.map(([cmd, key, ...args]) => {
        const k = String(key);
        switch (String(cmd).toUpperCase()) {
          case "HINCRBY": {
            const h = hashes.get(k) ?? new Map<string, number>();
            hashes.set(k, h);
            const n = (h.get(String(args[0])) ?? 0) + Number(args[1]);
            h.set(String(args[0]), n);
            return n;
          }
          case "HGETALL":
            return [...(hashes.get(k) ?? new Map()).entries()].flat().map(String);
          case "PFADD": {
            const st = sets.get(k) ?? new Set<string>();
            sets.set(k, st);
            const before = st.size;
            args.forEach((a) => st.add(String(a)));
            return st.size > before ? 1 : 0;
          }
          case "PFCOUNT":
            return sets.get(k)?.size ?? 0;
          case "EXPIRE":
            return 1;
          default:
            throw new Error(`memory pipeline: ${cmd} 지원 안 함`);
        }
      });
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
    incr: async (key, ttl, by = 1) => {
      const n = Number(await call(["INCRBY", key, by], true));
      if (n === by) await call(["EXPIRE", key, ttl], true);
      return n;
    },
    decr: async (key, by = 1) => Number(await call(["DECRBY", key, by], true)),
    pipeline: async (commands) => {
      if (!commands.length) return [];
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Request-Id": crypto.randomUUID() },
        body: JSON.stringify(commands),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`redis pipeline ${res.status}`);
      return ((await res.json()) as { result?: unknown; error?: string }[]).map((r) => r.result);
    },
  };
}

/**
 * 빌드 중에는 번역(tr…)만 저장하고 나머지 SET은 건너뛴다. 페이지 1,300개를 미리 만들며 빌드 한 번에 수만 건을 써서
 * 무료 한도(월 50만 명령)를 빌드가 거의 다 썼다 (10/19 Upstash 사용량). 번역은 다시 만들면 파파고 한도를 써서 저장한다
 */
function buildSafe(inner: KV): KV {
  const keep = (key: string) => key.startsWith("tr");
  return {
    ...inner,
    set: (key, value, ttl) => (keep(key) ? inner.set(key, value, ttl) : Promise.resolve()),
    setNX: (key, value, ttl) => (keep(key) ? inner.setNX(key, value, ttl) : Promise.resolve(true)),
  };
}

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
// 운영 배포만 Redis를 쓴다. Preview 배포·로컬(.env.local에 운영 Redis 주소가 있다)·CI는 메모리 (운영 한도를 나눠 쓰지 않게).
// 로컬에서 Redis를 꼭 봐야 하면 KV_FORCE=1
const useRedis = !!url && !!token && (process.env.VERCEL_ENV === "production" || process.env.KV_FORCE === "1");
const building = process.env.NEXT_PHASE === "phase-production-build";

export const kv: KV = useRedis ? (building ? buildSafe(upstashKV(url!, token!)) : upstashKV(url!, token!)) : memoryKV();
export const kvBackend = useRedis ? "redis" : "memory";
