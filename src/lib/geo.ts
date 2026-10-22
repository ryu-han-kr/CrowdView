// 위치 계산 (서버·브라우저 공용): 두 지점 거리, 이동시간 추정, 지도 앱 길찾기 링크

export interface LatLng {
  lat: number;
  lng: number;
}

/** 두 지점 직선거리 (km) */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Transport = "walk" | "transit" | "car";

/**
 * 이동시간 추정 (분). 길찾기 API 없이 직선거리 × 1.3(도로 우회)으로 계산한다.
 * 도보 시속 4.5km / 대중교통은 1.2km 넘으면 기다림·환승 12분 + 평균 시속 18km
 */
export function travelMinutes(a: LatLng, b: LatLng, mode: Transport): { minutes: number; km: number; walk: boolean; car?: boolean } {
  const km = distanceKm(a, b) * 1.3;
  const walk = mode === "walk" || km < (mode === "car" ? 0.8 : 1.2);
  // 자동차: 시내 시속 22km(10km 넘으면 35km) + 주차·출차 8분 (사용자 10/22: 대중교통·걷기·자동차)
  const minutes = walk ? (km / 4.5) * 60 : mode === "car" ? 8 + (km / (km > 10 ? 35 : 22)) * 60 : 12 + (km / 18) * 60;
  return { minutes: Math.max(1, Math.round(minutes)), km: Math.round(km * 10) / 10, walk, ...(!walk && mode === "car" && { car: true }) };
}

/** 카카오맵 길찾기 링크 (앱이 있으면 앱, 없으면 웹) */
export function kakaoDirections(from: LatLng & { name: string }, to: LatLng & { name: string }): string {
  const seg = (p: LatLng & { name: string }) => `${encodeURIComponent(p.name)},${p.lat},${p.lng}`;
  return `https://map.kakao.com/link/from/${seg(from)}/to/${seg(to)}`;
}

/** 브라우저 위치 (권한 요청). 실패하면 이유를 담아 reject */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable")),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  });
}
