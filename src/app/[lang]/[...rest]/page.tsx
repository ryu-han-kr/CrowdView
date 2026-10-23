import { notFound } from "next/navigation";

// 없는 주소: 언어 레이아웃 안의 '찾을 수 없어요' 화면(../not-found.tsx)으로 (UI QA 16차: 영어 기본 404가 나왔다)
export default function Unmatched() {
  notFound();
}
