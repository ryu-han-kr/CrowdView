// 비용 정산 리포트 PDF (A4). 한글은 나눔고딕을 임베드한다 (pdf-lib 서브셋은 한글 글리프가 빠지는 버그가 있어 전체 임베드)
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { reportPeriod, reportStamp, type CostReport } from "./report";

const FONT_DIR = path.join(process.cwd(), "assets/fonts");
const W = 595.28;
const H = 841.89;
const M = 48; // 여백

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.45, 0.45, 0.5);
const LINE = rgb(0.88, 0.88, 0.9);
const ACCENT = rgb(0.06, 0.45, 0.85);
const PANEL = rgb(0.95, 0.97, 1);

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const num = (n: number) => Math.round(n).toLocaleString("ko-KR");

export function reportFilename(r: CostReport): string {
  return `crowdview-cost-${r.generatedAtKst.slice(0, 10)}.pdf`;
}

export async function renderReportPdf(r: CostReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all(
    ["NanumGothic-Regular.ttf", "NanumGothic-Bold.ttf"].map(async (f) =>
      doc.embedFont(await readFile(path.join(FONT_DIR, f)), { subset: false }),
    ),
  );
  doc.setTitle(`CrowdView 비용 정산 리포트 ${r.generatedAtKst.slice(0, 10)}`);
  doc.setCreationDate(new Date(r.generatedAt));

  const page = doc.addPage([W, H]);
  const text = (s: string, x: number, y: number, size: number, font: PDFFont = regular, color = INK) =>
    page.drawText(s, { x, y, size, font, color });
  const right = (s: string, xRight: number, y: number, size: number, font: PDFFont = regular, color = INK) =>
    text(s, xRight - font.widthOfTextAtSize(s, size), y, size, font, color);

  // 머리말
  let y = H - M - 6;
  text("CrowdView 비용 정산 리포트", M, y, 20, bold);
  y -= 22;
  text(`발행 ${reportStamp(r)}`, M, y, 10.5, regular, MUTED);
  right(`집계 기간 ${reportPeriod(r)}`, W - M, y, 10.5, regular, MUTED);
  y -= 14;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: INK });

  // 요약
  y -= 74;
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 60, color: PANEL });
  const half = (W - 2 * M) / 2;
  for (const [i, [label, value]] of [
    ["이번 달 누적", won(r.monthToDateKrw)],
    ["월말 예상", won(r.projectedKrw)],
  ].entries()) {
    const x = M + 16 + i * half;
    text(label, x, y + 38, 10, regular, MUTED);
    text(value, x, y + 14, 18, bold, i === 0 ? INK : ACCENT);
  }

  // 네이버 클라우드
  y -= 34;
  text("네이버 클라우드", M, y, 13, bold);
  y -= 20;
  if ("error" in r.naver) {
    text(`조회 실패: ${r.naver.error.slice(0, 80)}`, M, y, 10, regular, rgb(0.8, 0.1, 0.1));
    y -= 10;
  } else {
    text(`청구 금액 (VAT 포함, NCP 집계 기준): ${won(r.naver.demandKrw)}`, M, y, 10.5);
    y -= 8;
    y = table(page, regular, bold, y, [210, 80, 90, 119], ["항목", `${r.latestDate?.slice(5) ?? "-"} 사용`, "이번 달 누적", "무료 한도 대비"],
      r.naver.usage.map((u) => [
        u.name,
        `${num(u.latestDay)}회`,
        `${num(u.monthToDate)}회`,
        u.free ? `${((u.monthToDate / u.free) * 100).toFixed(2)}% / ${num(u.free)}` : "-",
      ]),
    );
  }

  // 기타 서비스
  y -= 26;
  text("기타 서비스 (월 고정비)", M, y, 13, bold);
  y -= 8;
  y = table(page, regular, bold, y, [150, 100, 249], ["서비스", "월 비용", "상태"],
    r.fixed.map((f) => [f.name, won(f.krw), f.note]),
  );

  // 꼬리말
  const notes = [
    "· 네이버 클라우드 사용량은 하루 늦게 집계되어, 집계된 가장 최근 날짜를 기준으로 표시합니다.",
    "· 고정비는 경과 일수만큼 일할 계산해 누적 금액에 반영합니다.",
    "· 월말 예상 = 현재까지 변동비 ÷ 경과 일수 × 월 일수 + 고정비",
  ];
  notes.forEach((n, i) => text(n, M, M + 30 - i * 13, 8.5, regular, MUTED));
  right(`생성 ${r.generatedAtKst} KST`, W - M, M - 16, 8, regular, MUTED);

  return doc.save();
}

// 헤더 + 행. 첫 열은 왼쪽, 나머지는 오른쪽 정렬. 마지막 y를 반환
function table(page: PDFPage, regular: PDFFont, bold: PDFFont, y: number, widths: number[], head: string[], rows: string[][]): number {
  const rowH = 22;
  const draw = (cells: string[], font: PDFFont, color = INK) => {
    let x = M;
    cells.forEach((c, i) => {
      const w = widths[i];
      const size = 10;
      const tx = i === 0 ? x + 6 : x + w - 6 - font.widthOfTextAtSize(c, size);
      page.drawText(c, { x: tx, y: y - 15, size, font, color });
      x += w;
    });
    y -= rowH;
    page.drawLine({ start: { x: M, y }, end: { x: M + widths.reduce((a, b) => a + b, 0), y }, thickness: 0.6, color: LINE });
  };
  page.drawRectangle({ x: M, y: y - rowH, width: widths.reduce((a, b) => a + b, 0), height: rowH, color: rgb(0.96, 0.96, 0.97) });
  draw(head, bold, MUTED);
  rows.forEach((r) => draw(r, regular));
  return y;
}
