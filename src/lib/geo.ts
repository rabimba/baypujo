import type { LatLng } from "./types";

const R_MI = 3958.8; // Earth radius in miles

export function haversineMi(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(h));
}

/**
 * Rough driving time estimate for Bay Area distances.
 * Uses a road factor (detour ratio) + effective speed that degrades with
 * distance (local roads for short hops, freeways for long ones).
 * Returns minutes.
 */
export function driveTimeMin(distanceMi: number): number {
  const roadMi = distanceMi * 1.3;
  const speedMph = roadMi < 5 ? 22 : roadMi < 15 ? 32 : 45;
  return Math.max(5, Math.round((roadMi / speedMph) * 60));
}
