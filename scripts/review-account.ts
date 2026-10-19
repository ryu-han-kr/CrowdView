// 결제대행사·카드사 심사용 로그인 계정 (이메일·비밀번호). 사이트는 가입을 막아 두었으니 여기서만 만든다.
//   만들기: node --env-file=.env.local --import tsx scripts/review-account.ts create   → ID·비밀번호를 한 번 출력
//   지우기: node --env-file=.env.local --import tsx scripts/review-account.ts delete   (심사가 끝나면)
// 로그인 화면: https://crowdview.app/login?review=1
import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { pool } from "../src/lib/db";

const EMAIL = "review@crowdview.app";

async function main(cmd?: string) {
  if (!pool) throw new Error("DATABASE_URL이 없어요 (.env.local)");

  if (cmd === "create") {
    await pool.query(`DELETE FROM "user" WHERE email = $1`, [EMAIL]);
    const password = randomBytes(12).toString("base64url");
    // 가입을 허용한 임시 인스턴스로 만든다 (비밀번호 해시 방식은 사이트와 같다)
    const auth = betterAuth({ database: pool, secret: randomBytes(32).toString("hex"), emailAndPassword: { enabled: true } });
    await auth.api.signUpEmail({ body: { email: EMAIL, password, name: "심사용 계정" } });
    console.log(`ID ${EMAIL}\nPW ${password}`);
  } else if (cmd === "delete") {
    const { rowCount } = await pool.query(`DELETE FROM "user" WHERE email = $1`, [EMAIL]);
    console.log(rowCount ? "지웠어요" : "계정이 없어요");
  } else {
    console.log("create | delete");
  }
  await pool.end();
}

main(process.argv[2]);
