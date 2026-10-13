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

function popcount(x: number): number {
  let c = 0;
  while (x) {
    c += x & 1;
    x >>= 1;
  }
  return c;
}

interface OptionalPlan {
  stops: PlanStop[];
  totalDrive: number;
  totalDist: number;
}

/** Nearest-feasible-first fallback — used only above MAX_OPTIONAL_DP_N,
 *  so a pathological future candidate count can't hang the UI. */
function greedyFill(
  nodes: Puja[],
  date: string,
  dwellMin: number,
  end: number,
  startClock: number,
  startLoc: LatLng,
): OptionalPlan {
  const remaining = new Map(nodes.map((p) => [p.id, p]));
  const stops: PlanStop[] = [];
  let clock = startClock;
  let current = startLoc;
  let totalDrive = 0;
  let totalDist = 0;
  while (true) {
    const feasible = [...remaining.values()].filter((p) =>
      isFeasible(computeArrival(p, date, dwellMin, clock, current), end),
    );
    if (feasible.length === 0) break;
    const next = feasible.sort(
      (a, b) => haversineMi(current, a.venue) - haversineMi(current, b.venue),
    )[0];
    const v = computeArrival(next, date, dwellMin, clock, current);
    stops.push(toPlanStop(next, date, v, false));
    remaining.delete(next.id);
    totalDrive += v.drive;
    totalDist += v.dist;
    clock = v.depart;
    current = next.venue;
  }
  return { stops, totalDrive, totalDist };
}

/** 2^16 × 16 ≈ 1M DP states — sub-50ms. Real data maxes out at 14
 *  candidates on the busiest day; this leaves headroom before falling
 *  back to the greedy approximation. */
const MAX_OPTIONAL_DP_N = 16;

/**
 * Exact best fill of optional stops after the must-visit skeleton is
 * placed. dp[mask][last] = earliest possible departure having visited
 * exactly the stop-set `mask`, ending at `last` — a state reached earlier
 * strictly dominates the same state reached later (every future option
 * stays open), so keeping only the minimum departure per (mask, last) is
 * sufficient; no need to track alternate arrival times for the same state.
 * Dwell time is constant per stop count, so for a fixed popcount, minimum
 * departure is exactly minimum drive+wait — ranking by (most stops, then
 * earliest departure) is therefore also (most stops, then least driving).
 */
function bestOptionalFill(
  nodes: Puja[],
  date: string,
  dwellMin: number,
  end: number,
  startClock: number,
  startLoc: LatLng,
): OptionalPlan {
  if (nodes.length === 0) return { stops: [], totalDrive: 0, totalDist: 0 };
  if (nodes.length > MAX_OPTIONAL_DP_N) {
    return greedyFill(nodes, date, dwellMin, end, startClock, startLoc);
  }

  const n = nodes.length;
  const size = 1 << n;
  const windows = nodes.map((p) => windowFor(p, date));
  const driveFromStart = nodes.map((p) => driveTimeMin(haversineMi(startLoc, p.venue)));
  const driveBetween: number[][] = nodes.map((a) =>
    nodes.map((b) => driveTimeMin(haversineMi(a.venue, b.venue))),
  );

  const depart = new Float64Array(size * n).fill(Infinity);
  const parent = new Int32Array(size * n).fill(-1);

  for (let i = 0; i < n; i++) {
    const arrive = startClock + driveFromStart[i];
    const dep = Math.max(arrive, windows[i].open) + dwellMin;
    if (arrive <= windows[i].close && dep <= windows[i].close && dep <= end) {
      depart[(1 << i) * n + i] = dep;
    }
  }

  for (let mask = 1; mask < size; mask++) {
    for (let last = 0; last < n; last++) {
      if (!(mask & (1 << last))) continue;
      const fromIdx = mask * n + last;
      const d = depart[fromIdx];
      if (d === Infinity) continue;
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue;
        const arrive = d + driveBetween[last][next];
        const win = windows[next];
        const dep = Math.max(arrive, win.open) + dwellMin;
        if (arrive > win.close || dep > win.close || dep > end) continue;
        const toIdx = (mask | (1 << next)) * n + next;
        if (dep < depart[toIdx]) {
          depart[toIdx] = dep;
          parent[toIdx] = fromIdx;
        }
      }
    }
  }

  let bestIdx = -1;
  let bestPopcount = 0;
  let bestDepart = Infinity;
  for (let mask = 1; mask < size; mask++) {
    const pc = popcount(mask);
    if (pc < bestPopcount) continue; // can't beat the best even with last=anything
    for (let last = 0; last < n; last++) {
      if (!(mask & (1 << last))) continue;
      const d = depart[mask * n + last];
      if (d === Infinity) continue;
      if (pc > bestPopcount || d < bestDepart) {
        bestPopcount = pc;
        bestDepart = d;
        bestIdx = mask * n + last;
      }
    }
  }
  if (bestIdx === -1) return { stops: [], totalDrive: 0, totalDist: 0 };

  const order: number[] = [];
  for (let idx = bestIdx; idx !== -1; idx = parent[idx]) {
    order.unshift(idx % n);
  }

  const stops: PlanStop[] = [];
  let clock = startClock;
  let current = startLoc;
  let totalDrive = 0;
  let totalDist = 0;
  for (const i of order) {
    const v = computeArrival(nodes[i], date, dwellMin, clock, current);
    stops.push(toPlanStop(nodes[i], date, v, false));
    clock = v.depart;
    current = nodes[i].venue;
    totalDrive += v.drive;
    totalDist += v.dist;
  }
  return { stops, totalDrive, totalDist };
}

export function planParikroma(input: PlannerInput): PlanResult {
  const start = hmToMin(input.startTime);
  const end = hmToMin(input.endTime);
  const skipped: Skipped[] = [];

  const remaining = new Map(input.candidates.map((p) => [p.id, p]));
  for (const id of input.mustVisit) {
    if (!remaining.has(id)) {
      const p = input.candidates.find((x) => x.id === id) ?? allPujas.find((x) => x.id === id);
      if (p) skipped.push({ puja: p, reason: "Not active on selected date" });
    }
  }
  const musts = input.mustVisit
    .filter((id) => remaining.has(id))
    .map((id) => remaining.get(id)!);

  const stops: PlanStop[] = [];
  let current: LatLng = input.origin;
  let clock = start;

  // Phase 1 — must-visits are a protected skeleton, scheduled in whichever
  // order makes all of them feasible (see bestMustOrder). Optional stops
  // never get to bump a must-visit out of the plan.
  //
  // Split off any must-visit that doesn't fit the user's day at all (direct
  // from origin, on its own) — that one gets the ordinary "doesn't fit your
  // hours" reason below, not a "conflicts with your other pick" message
  // that would be nonsensical when it's the only must-visit, or simply
  // wrong when it was never reachable regardless of the others.
  const soloInfeasible = musts.filter(
    (p) => !isFeasible(computeArrival(p, input.date, input.dwellMin, start, input.origin), end),
  );
  const soloFeasible = musts.filter((p) => !soloInfeasible.includes(p));

  const mustPlan = bestMustOrder(soloFeasible, input.date, input.dwellMin, end, start, input.origin);
  if (mustPlan) {
    stops.push(...mustPlan.stops);
    clock = mustPlan.finishClock;
    current = mustPlan.current;
    for (const p of mustPlan.stops) remaining.delete(p.puja.id);
  } else if (soloFeasible.length > 0) {
    // Each of these fits fine on its own — they only conflict with each
    // other.
    const names = soloFeasible.map((p) => p.name).join(", ");
    for (const p of soloFeasible) {
      skipped.push({
        puja: p,
        reason: `Doesn't fit together with your other must-visit pick${soloFeasible.length > 2 ? "s" : ""} (${names}) in one day — try removing one`,
      });
      remaining.delete(p.id);
    }
  }
  // soloInfeasible must-visits are left in `remaining` on purpose — the
  // generic reasons loop below already explains exactly why each one
  // doesn't fit (too early a close, too far, past your cutoff, etc.).

  let totalDriveMin = stops.reduce((sum, s) => sum + s.driveFromPrevMin, 0);
  let totalDriveMi = stops.reduce((sum, s) => sum + s.distanceFromPrevMi, 0);

  // Phase 2 — fill whatever time is left with optional stops. Exact
  // bitmask DP (see bestOptionalFill) below MAX_OPTIONAL_DP_N candidates.
  const optionalPlan = bestOptionalFill(
    [...remaining.values()],
    input.date,
    input.dwellMin,
    end,
    clock,
    current,
  );
  stops.push(...optionalPlan.stops);
  totalDriveMin += optionalPlan.totalDrive;
  totalDriveMi += optionalPlan.totalDist;
  for (const s of optionalPlan.stops) remaining.delete(s.puja.id);

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
          : `~${Math.round(distMi)} mi away — fits your hours on its own, but didn't make the most efficient plan — mark it must-visit to include it`,
      });
    }
  }

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
  const originTooFar =
    stops.length === 0 && nearestMi !== null && nearestMi > city.warnRadiusMi;

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
