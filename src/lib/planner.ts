import type { LatLng, Puja, ScheduleEvent } from "./types";
import { driveTimeMin, haversineMi } from "./geo";
import { hoursOn } from "./pujas";
import { pujas as allPujas } from "./pujas";
import { city } from "./city-data";

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
    /** True when the start point is far outside the metro — likely a
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

interface Arrival {
  win: { open: number; close: number };
  dist: number;
  drive: number;
  arrive: number;
  depart: number;
}

/** Drive/arrival/departure math for visiting `puja` next, from (clock, current). */
function computeArrival(
  puja: Puja,
  date: string,
  dwellMin: number,
  clock: number,
  current: LatLng,
): Arrival {
  const win = windowFor(puja, date);
  const dist = haversineMi(current, puja.venue);
  const drive = driveTimeMin(dist);
  const arrive = clock + drive;
  const depart = Math.max(arrive, win.open) + dwellMin;
  return { win, dist, drive, arrive, depart };
}

/** Arrive before close, leave before close, leave before the user's day ends. */
function isFeasible(v: Arrival, end: number): boolean {
  return v.arrive <= v.win.close && v.depart <= v.win.close && v.depart <= end;
}

function toPlanStop(
  puja: Puja,
  date: string,
  v: Arrival,
  isMustVisit: boolean,
): PlanStop {
  const visitStart = Math.max(v.arrive, v.win.open);
  const events = puja.schedule
    .filter(
      (e): e is ScheduleEvent & { start: string } =>
        e.date === date && e.start !== null,
    )
    .filter(
      (e) =>
        hmToMin(e.start) < v.depart &&
        (e.end ? hmToMin(e.end) : hmToMin(e.start) + 90) > visitStart,
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  return {
    puja,
    arrive: v.arrive,
    depart: v.depart,
    driveFromPrevMin: v.drive,
    distanceFromPrevMi: v.dist,
    isMustVisit,
    events,
  };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([items[i], ...tail]);
  }
  return out;
}

/** Nearest-unvisited-next ordering — fallback when there are too many
 *  must-visits to exhaustively permute (see MAX_MUST_PERMUTE). */
function nearestFirstOrder(musts: Puja[], startLoc: LatLng): Puja[] {
  const remaining = musts.slice();
  const order: Puja[] = [];
  let current = startLoc;
  while (remaining.length > 0) {
    remaining.sort(
      (a, b) => haversineMi(current, a.venue) - haversineMi(current, b.venue),
    );
    const next = remaining.shift()!;
    order.push(next);
    current = next.venue;
  }
  return order;
}

/** 7! = 5040 orderings — trivial to check exhaustively. Past that (an
 *  extreme number of must-visits), fall back to nearest-first. */
const MAX_MUST_PERMUTE = 7;

interface MustPlan {
  stops: PlanStop[];
  finishClock: number;
  current: LatLng;
}

/**
 * The must-visit stops are a protected skeleton: every order that visits
 * ALL of them within their own hours is tried (exhaustively, for any
 * realistic must-visit count), and the one finishing earliest wins — so a
 * tight-deadline must-visit can never be silently stranded behind a
 * nearer but slack-rich one. Optional stops never compete for these slots;
 * they only fill whatever's left afterward (see planParikroma).
 * Returns null when no order visits every must-visit feasibly.
 */
function bestMustOrder(
  musts: Puja[],
  date: string,
  dwellMin: number,
  end: number,
  startClock: number,
  startLoc: LatLng,
): MustPlan | null {
  if (musts.length === 0) {
    return { stops: [], finishClock: startClock, current: startLoc };
  }
  const orders =
    musts.length <= MAX_MUST_PERMUTE
      ? permutations(musts)
      : [nearestFirstOrder(musts, startLoc)];

  let best: MustPlan | null = null;
  for (const order of orders) {
    let clock = startClock;
    let current = startLoc;
    const stops: PlanStop[] = [];
    let ok = true;
    for (const p of order) {
      const v = computeArrival(p, date, dwellMin, clock, current);
      if (!isFeasible(v, end)) {
        ok = false;
        break;
      }
      stops.push(toPlanStop(p, date, v, true));
      clock = v.depart;
      current = p.venue;
    }
    if (ok && (!best || clock < best.finishClock)) {
      best = { stops, finishClock: clock, current };
    }
  }
  return best;
}

export function planParikroma(input: PlannerInput): PlanResult {
  const start = hmToMin(input.startTime);
  const end = hmToMin(input.endTime);
  const skipped: Skipped[] = [];

  // The plan only ever contains pujas the user explicitly selected — never
  // anything auto-added to "fill" the day. `candidates` (pujas active on
  // the date) is used only to validate selections and for the far-origin
  // diagnostic below, never as a pool to draw extra stops from.
  const activeById = new Map(input.candidates.map((p) => [p.id, p]));
  for (const id of input.mustVisit) {
    if (!activeById.has(id)) {
      const p = allPujas.find((x) => x.id === id);
      if (p) skipped.push({ puja: p, reason: "Not active on selected date" });
    }
  }
  const musts = input.mustVisit
    .filter((id) => activeById.has(id))
    .map((id) => activeById.get(id)!);

  const stops: PlanStop[] = [];

  // Must-visits are scheduled as a protected group: every order that gets
  // all of them there in time is tried exhaustively (see bestMustOrder),
  // and the fastest-finishing one wins — so a tight-deadline pick can't be
  // stranded behind a nearer slack-rich one.
  //
  // Split off anything that doesn't fit the day at all on its own first —
  // that gets the ordinary "doesn't fit your hours" reason below, not a
  // "conflicts with your other pick" message that would be nonsensical
  // for a single selection, or simply wrong when it was never reachable
  // regardless of the others.
  const soloInfeasible = musts.filter(
    (p) => !isFeasible(computeArrival(p, input.date, input.dwellMin, start, input.origin), end),
  );
  const soloFeasible = musts.filter((p) => !soloInfeasible.includes(p));

  const mustPlan = bestMustOrder(soloFeasible, input.date, input.dwellMin, end, start, input.origin);
  if (mustPlan) {
    stops.push(...mustPlan.stops);
  } else if (soloFeasible.length > 0) {
    // Each of these fits fine on its own — they only conflict with each
    // other.
    const names = soloFeasible.map((p) => p.name).join(", ");
    for (const p of soloFeasible) {
      skipped.push({
        puja: p,
        reason: `Doesn't fit together with your other must-visit pick${soloFeasible.length > 2 ? "s" : ""} (${names}) in one day — try removing one`,
      });
    }
  }

  for (const p of soloInfeasible) {
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
      continue;
    }
    const depart = Math.max(arrive, win.open) + input.dwellMin;
    skipped.push({
      puja: p,
      reason: depart > end
        ? `~${Math.round(distMi)} mi away — visit would end ${minToHm(depart)}, after your ${minToHm(end)} cutoff`
        : `~${Math.round(distMi)} mi away — not enough time there before it closes`,
    });
  }

  const totalDriveMin = stops.reduce((sum, s) => sum + s.driveFromPrevMin, 0);
  const totalDriveMi = stops.reduce((sum, s) => sum + s.distanceFromPrevMi, 0);

  const lastEnd = stops.length > 0 ? stops[stops.length - 1].depart : start;

  // If nothing is reachable even from the closest puja, the start point is
  // almost certainly far outside the metro (bad IP geolocation, VPN,
  // mistyped address). Surface that instead of a wall of "too far".
  const nearestMi =
    input.candidates.length > 0
      ? Math.min(
          ...input.candidates.map((p) => haversineMi(input.origin, p.venue)),
        )
      : null;
  // Gated on an actual selection — with nothing picked yet, 0 stops just
  // means nothing was asked for, not that the origin looks wrong.
  const originTooFar =
    musts.length > 0 &&
    stops.length === 0 &&
    nearestMi !== null &&
    nearestMi > city.warnRadiusMi;

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
