// 운영자 확인: ADMIN_EMAILS(쉼표로 여러 명)에 있는 이메일로 로그인한 사람만 /admin·/api/admin 을 쓸 수 있다
import { currentUser } from "./auth";

const ADMINS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const isAdminEmail = (email?: string | null) => !!email && ADMINS.includes(email.toLowerCase());

/** 지금 로그인한 운영자 (아니면 null) */
export async function currentAdmin(reqHeaders?: Headers) {
  if (!ADMINS.length) return null;
  const user = await currentUser(reqHeaders);
  return user && isAdminEmail(user.email) ? user : null;
}
