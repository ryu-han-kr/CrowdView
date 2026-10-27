// 혼잡도 지도 첫 그림(정적 미리보기)의 틀. 그림(public/map/korea.webp, scripts/map-preview/build.mts 로 생성)과
// 그 위에 찍는 핀(SpotMap)이 같은 투영을 써야 자리가 맞는다. 평면 투영(위도 1° = 세로 1, 경도 1° = cos(36°)).
// 틀은 우리 장소·서울 지역·명소 전체(위도 33.2~38.2, 경도 126.1~129.4)에 바다 여백을 더한 것
export const MAP_FRAME = { latMin: 32.9, latMax: 38.8, lngMin: 125.6, lngMax: 130.3 } as const;
const COS = Math.cos((35.8 * Math.PI) / 180);
/** 그림 크기 (px). 세로 1200 = 위도 5.8° → 1° ≈ 207px */
export const MAP_PREVIEW_H = 1200;
export const MAP_PREVIEW_W = Math.round((MAP_PREVIEW_H * (MAP_FRAME.lngMax - MAP_FRAME.lngMin) * COS) / (MAP_FRAME.latMax - MAP_FRAME.latMin));

/** 위경도 → 그림 좌표 (px). 틀 밖이면 그림 밖 좌표가 나온다 */
export function projectToPreview(lat: number, lng: number): [x: number, y: number] {
  const x = ((lng - MAP_FRAME.lngMin) / (MAP_FRAME.lngMax - MAP_FRAME.lngMin)) * MAP_PREVIEW_W;
  const y = ((MAP_FRAME.latMax - lat) / (MAP_FRAME.latMax - MAP_FRAME.latMin)) * MAP_PREVIEW_H;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}
