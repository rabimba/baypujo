import type { LatLng, Puja, ScheduleEvent } from "./types";
import { driveTimeMin, haversineMi } from "./geo";
import { hoursOn } from "./pujas";
import { pujas as allPujas } from "./pujas";

export interface PlannerInput {
  date: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  origin: LatLng;
  dwellMin: number; // minutes spent at each puja
  mustVisit: string[]; // puja ids
  candidates: Puja[]; // pujas active on the date
}

export interface PlanStop {
  puja: Puja;
  arrive: number; // minutes from midnight
  depart: number; // minutes from midnight
  driveFromPrevMin: number;
  distanceFromPrevMi: number;
  isMustVisit: boolean;
  events: ScheduleEvent[]; // schedule events happening during the stay
}

export interface Skipped {
  puja: Puja;
  reason: string;
}

export interface PlanResult {
  stops: PlanStop[];
  skipped: Skipped[];
  totalDriveMin: number;
  totalDriveMi: number;
  freeTimeMin: number; // slack at end
  diagnostics: {
    nearestPujaMi: number | null;
    /** True when the start point is far outside the Bay Area — likely a
     *  bad geolocation fix or wrong address, not a scheduling problem. */
    originTooFar: boolean;
  };
}

export function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function minToHm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  return `${String(h).padStart(2, "0")}:${mm}`;
}

/** Opening hours for a puja on a date: organizer hours > schedule span > default 10–20. */
export function openWindow(
  puja: Puja,
  date: string,
): { open: number; close: number } | null {
  const hours = hoursOn(puja, date);
  if (hours) {
    return { open: hmToMin(hours.open), close: hmToMin(hours.close) };
  }
  const events = puja.schedule.filter(
    (e): e is ScheduleEvent & { start: string } =>
      e.date === date && e.start !== null,
  );
  if (events.length === 0) return null;
  const open = Math.min(...events.map((e) => hmToMin(e.start)));
  const ends = events.map((e) =>
    e.end ? hmToMin(e.end) : hmToMin(e.start) + 90,
  );
  const close = Math.max(...ends);
  return { open, close };
}

/** Default full-day window when no schedule published: 10:00–20:00. */
export const DEFAULT_WINDOW = { open: 600, close: 1200 };

export function windowFor(puja: Puja, date: string) {
  return openWindow(puja, date) ?? DEFAULT_WINDOW;
}

export function planParikroma(input: PlannerInput): PlanResult {
  const start = hmToMin(input.startTime);
  const end = hmToMin(input.endTime);
  const stops: PlanStop[] = [];
  const skipped: Skipped[] = [];
  let totalDriveMin = 0;
  let totalDriveMi = 0;

  const remaining = new Map(input.candidates.map((p) => [p.id, p]));
  const mustRemaining = new Set(
    input.mustVisit.filter((id) => remaining.has(id)),
  );
  for (const id of input.mustVisit) {
    if (!remaining.has(id)) {
      const p = input.candidates.find((x) => x.id === id) ?? allPujas.find((x) => x.id === id);
      if (p) skipped.push({ puja: p, reason: "Not active on selected date" });
    }
  }

  let current: LatLng = input.origin;
  let clock = start;

  while (true) {
    // Feasibility: arrive before close, leave after arrival + dwell, within window end
    const feasible = [...remaining.values()].filter((p) => {
      const win = windowFor(p, input.date);
      const drive = driveTimeMin(haversineMi(current, p.venue));
      const arrive = clock + drive;
      const depart = Math.max(arrive, win.open) + input.dwellMin;
      if (arrive > win.close || depart > win.close) return false;
      if (depart > end) return false;
      return true;
    });

    if (feasible.length === 0) break;

    // Prefer must-visit first; otherwise nearest feasible
    let next: Puja;
    if (mustRemaining.size > 0) {
      const musts = feasible.filter((p) => mustRemaining.has(p.id));
      if (musts.length > 0) {
        next = musts.sort(
          (a, b) =>
            haversineMi(current, a.venue) - haversineMi(current, b.venue),
        )[0];
      } else {
        next = feasible.sort(
          (a, b) =>
            haversineMi(current, a.venue) - haversineMi(current, b.venue),
        )[0];
      }
    } else {
      next = feasible.sort(
        (a, b) => haversineMi(current, a.venue) - haversineMi(current, b.venue),
      )[0];
    }

    const win = windowFor(next, input.date);
    const dist = haversineMi(current, next.venue);
    const drive = driveTimeMin(dist);
    const arrive = clock + drive;
    const visitStart = Math.max(arrive, win.open);
    const depart = visitStart + input.dwellMin;

    const events = next.schedule
      .filter(
        (e): e is ScheduleEvent & { start: string } =>
          e.date === input.date && e.start !== null,
      )
      .filter(
        (e) =>
          hmToMin(e.start) < depart &&
          (e.end ? hmToMin(e.end) : hmToMin(e.start) + 90) > visitStart,
      )
      .sort((a, b) => a.start.localeCompare(b.start));

    stops.push({
      puja: next,
      arrive,
      depart,
      driveFromPrevMin: drive,
      distanceFromPrevMi: dist,
      isMustVisit: mustRemaining.has(next.id),
      events,
    });

    mustRemaining.delete(next.id);
    remaining.delete(next.id);
    totalDriveMin += drive;
    totalDriveMi += dist;
    clock = depart;
    current = next.venue;
  }

  for (const p of remaining.values()) {
    const win = windowFor(p, input.date);
    if (win.close < start) {
      skipped.push({
        puja: p,
        reason: `Closes ${minToHm(win.close)} — before your ${minToHm(start)} start`,
      });
      continue;
    }
    const distMi = haversineMi(input.origin, p.venue);
    const drive = driveTimeMin(distMi);
    const arrive = start + drive;
    if (arrive > win.close) {
      skipped.push({
        puja: p,
        reason: `~${Math.round(distMi)} mi away — earliest arrival ${minToHm(arrive)}, after ${minToHm(win.close)} closing`,
      });
    } else {
      const depart = Math.max(arrive, win.open) + input.dwellMin;
      skipped.push({
        puja: p,
        reason: depart > end
          ? `~${Math.round(distMi)} mi away — visit would end ${minToHm(depart)}, after your ${minToHm(end)} cutoff`
          : `~${Math.round(distMi)} mi away — could not fit arrival + ${input.dwellMin} min before closing`,
      });
    }
  }

  const lastEnd = stops.length > 0 ? stops[stops.length - 1].depart : start;

  // If nothing is reachable even from the closest puja, the start point is
  // almost certainly far outside the Bay Area (bad IP geolocation, VPN,
  // mistyped address). Surface that instead of a wall of "too far".
  const nearestMi =
    input.candidates.length > 0
      ? Math.min(
          ...input.candidates.map((p) => haversineMi(input.origin, p.venue)),
        )
      : null;
  const originTooFar = stops.length === 0 && nearestMi !== null && nearestMi > 75;

  return {
    stops,
    skipped,
    totalDriveMin,
    totalDriveMi,
    freeTimeMin: Math.max(0, end - lastEnd),
    diagnostics: {
      nearestPujaMi: nearestMi,
      originTooFar,
    },
  };
}
