// 소셜 로그인 (Better Auth): 카카오·네이버·구글. 비밀번호는 받지 않는다.
// 회원·세션은 우리 Postgres(lib/db.ts)에 저장 → 외부 인증 서비스에 묶이지 않고 직접 운영 클라우드로 옮길 수 있다.
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { pool } from "./db";

const SITE = process.env.BETTER_AUTH_URL ?? "https://crowdview.app";

export const authEnabled = !!pool && !!process.env.BETTER_AUTH_SECRET;

const providers = {
  ...(process.env.KAKAO_CLIENT_ID && {
    kakao: {
      clientId: process.env.KAKAO_CLIENT_ID,
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
      // 이메일 동의는 비즈 앱만 받을 수 있어 기본 범위(account_email)를 빼고 닉네임·사진만 요청한다
      disableDefaultScope: true,
      scope: ["profile_nickname", "profile_image"],
      // 이메일이 없으면 카카오 회원번호로 내부용 주소를 만든다 (메일을 보내지 않는다).
      // 닉네임·사진은 kakao_account.profile에 오고, 예전 앱은 properties에만 온다 → 둘 다 본다
      mapProfileToUser: (profile: {
        id: number;
        kakao_account?: { email?: string; profile?: { nickname?: string; profile_image_url?: string } };
        properties?: { nickname?: string; profile_image?: string };
      }) => {
        const name = profile.kakao_account?.profile?.nickname || profile.properties?.nickname;
        const image = profile.kakao_account?.profile?.profile_image_url || profile.properties?.profile_image;
        return {
          email: profile.kakao_account?.email ?? `kakao-${profile.id}@users.crowdview.app`,
          ...(name && { name }),
          ...(image && { image }),
        };
      },
      // 동의 항목을 나중에 바꾸거나 이름·사진을 바꾸면 다음 로그인 때 반영
      overrideUserInfoOnSignIn: true,
    },
  }),
  ...(process.env.NAVER_CLIENT_ID && {
    naver: {
      clientId: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET ?? "",
      // 이메일 제공을 거절(선택 항목)하면 email_not_found로 가입이 막힌다 → 카카오처럼 네이버 회원번호로 내부용 주소 (메일을 보내지 않는다)
      mapProfileToUser: (profile: { response?: { id?: string; email?: string } }) => ({
        email: profile.response?.email || `naver-${profile.response?.id}@users.crowdview.app`,
      }),
      overrideUserInfoOnSignIn: true,
    },
  }),
  ...(process.env.GOOGLE_CLIENT_ID && {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      overrideUserInfoOnSignIn: true,
    },
  }),
};

export const auth = betterAuth({
  appName: "CrowdView",
  baseURL: SITE,
  secret: process.env.BETTER_AUTH_SECRET,
  // DB가 없으면 메모리 대신 꺼 둔다 (authEnabled=false, 라우트가 404)
  database: pool ?? undefined,
  socialProviders: providers,
  account: { accountLinking: { enabled: true, trustedProviders: ["kakao", "naver", "google"] } },
  // 마이페이지 '회원 탈퇴' (찜·알림·구독은 DB에서 함께 지워지고, 결제 기록은 법정 보관을 위해 user_id만 비운다)
  user: {
    deleteUser: {
      enabled: true,
      // 탈퇴 전에 정기결제 예약을 취소한다 (환불은 환불정책대로 고객센터에서)
      beforeDelete: async (user) => {
        const { cancel } = await import("./plus");
        await cancel(user.id).catch(() => {});
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  trustedOrigins: [SITE, "http://localhost:3000", "http://127.0.0.1:3100"],
  plugins: [nextCookies()],
});

/** 서버 컴포넌트·라우트에서 지금 로그인한 사용자 (없으면 null). 라우트 핸들러는 req.headers를 넘긴다 */
export async function currentUser(reqHeaders?: Headers) {
  if (!authEnabled) return null;
  const session = await auth.api.getSession({ headers: reqHeaders ?? (await headers()) }).catch(() => null);
  return session?.user ?? null;
}

/** 켜져 있는 로그인 수단 (버튼 표시용) */
export const enabledProviders = Object.keys(providers) as ("kakao" | "naver" | "google")[];
