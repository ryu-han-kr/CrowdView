// 안드로이드 앱(TWA)이 이 사이트 소유자의 앱임을 증명하는 파일 (Digital Asset Links).
// 플레이 콘솔 → 앱 무결성 → 앱 서명 키 인증서의 SHA-256 지문을 ANDROID_CERT_SHA256에 넣는다(여러 개면 쉼표).
// 이게 맞아야 앱 위쪽에 주소창이 안 보인다
export const dynamic = "force-static";

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE ?? "app.crowdview.twa";
  const prints = (process.env.ANDROID_CERT_SHA256 ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const body = prints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints } }]
    : [];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
