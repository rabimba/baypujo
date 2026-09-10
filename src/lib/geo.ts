import type { LatLng } from "./types";
import { city } from "./city-data";

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
 * Rough driving time estimate (minutes) for metro distances.
 * Road factor (detour ratio) and speed tiers come from the city config —
 * each metro's grid/freeway mix differs.
 */
export function driveTimeMin(distanceMi: number): number {
  const { roadFactor, speedsMph } = city.driveParams;
  const roadMi = distanceMi * roadFactor;
  // BA-style tiers: <5mi local, <15mi arterial, else freeway.
  const speed = roadMi < 5 ? speedsMph[0] : roadMi < 15 ? speedsMph[1] : speedsMph[2];
  return Math.max(5, Math.round((roadMi / speed) * 60));
}
