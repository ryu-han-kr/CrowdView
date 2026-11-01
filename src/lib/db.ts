// Postgres 연결 (회원·구독·결제·알림). 표준 Postgres라 Neon·Supabase·RDS·직접 운영 DB 어디로든 옮길 수 있다.
// DATABASE_URL이 없으면 null → 로그인·결제 기능이 꺼지고 나머지 서비스는 그대로 동작한다.
import { Pool, type QueryResultRow } from "pg";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

const g = globalThis as unknown as { __crowdPg?: Pool; __crowdPgErr?: boolean };

/** 서버리스에서 연결이 쌓이지 않게 프로세스당 하나 (개발 서버 새로고침에도 재사용) */
export const pool: Pool | null = url
  ? (g.__crowdPg ??= new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 10_000,
      // 쉬는 연결을 Neon이 먼저 끊기 전에 살아 있는지 확인 (Sentry CROWDVIEW-3·4 'Connection terminated unexpectedly')
      keepAlive: true,
      // 로컬(127.0.0.1)이 아니면 TLS
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    }))
  : null;

// 쉬는 연결이 끊기면 Pool이 'error'를 내는데, 받는 곳이 없으면 프로세스 전체가 예외로 죽는다. 그 연결만 버리면 다음 요청은 새 연결로 간다
if (pool && !g.__crowdPgErr) {
  g.__crowdPgErr = true;
  pool.on("error", (e) => console.warn("[db] 쉬는 연결 끊김:", e.message));
}

export const dbEnabled = !!pool;

export async function sql<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!pool) throw new Error("DATABASE_URL 미설정");
  return (await pool.query<T>(text, params)).rows;
}
