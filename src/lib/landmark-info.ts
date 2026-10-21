// 대표 명소 117곳의 관광공사 상세 (개요·주소·이용시간·쉬는날·사진). 데이터: scripts/korea-data/landmark-info.mjs
// 서버에서만 쓴다 (130KB 정도라 화면 묶음에 넣지 않는다)
import info from "@/data/korea/landmark-info.json";

export interface LandmarkInfo {
  overview: string;
  addr: string;
  tel?: string;
  homepage?: string;
  usetime?: string;
  restdate?: string;
  parking?: string;
  images: string[];
}

export const LANDMARK_INFO = info as Record<string, LandmarkInfo>;
