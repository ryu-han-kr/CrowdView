"use client";

/**
 * 레이아웃까지 오류가 난 경우의 마지막 화면 (사용자 10/24: 오류 화면도 캐릭터로).
 * 레이아웃·전역 CSS·번역이 없으므로 html·body와 스타일을 직접 넣고, 한국어·영어를 함께 적는다
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: "#f8fafc", color: "#0f172a", fontFamily: "Pretendard, system-ui, -apple-system, 'Malgun Gothic', sans-serif" }}>
        <title>CrowdView</title>
        <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 20, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/characters/hamster/packed.webp" width={135} height={180} alt="" />
          <h1 style={{ margin: 0, fontSize: 18 }}>앗, 잠시 문제가 생겼어요</h1>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Something went wrong. Please try again.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => retry()}
              style={{ border: 0, borderRadius: 999, background: "#4f46e5", color: "#fff", padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              다시 시도 · Retry
            </button>
            <a href="/" style={{ borderRadius: 999, background: "#e2e8f0", color: "#1e293b", padding: "10px 20px", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              홈 · Home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
