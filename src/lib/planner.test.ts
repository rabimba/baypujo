import { describe, expect, it } from "vitest";
import { haversineMi, driveTimeMin } from "./geo";
import { hmToMin, minToHm, openWindow, planParikroma } from "./planner";
import type { Puja } from "./types";
import { pujas } from "./pujas";
import { CITY_ID, city as cityCfg } from "./city-data";
const cityCenter = cityCfg.center;
const BA = CITY_ID === "bayarea";
const itBA = BA ? it : it.skip;

const iccMilpitas = { lat: 37.4319231, lng: -121.8952529 };
const newarkPavilion = { lat: 37.5332703, lng: -122.0324619 };

function fakePuja(id: string, venue: { lat: number; lng: number }, win?: { open: string; close: string }): Puja {
  const base = pujas[0];
  return {
    ...base,
    id,
    name: `Puja ${id}`,
    venue: { ...base.venue, ...venue },
    schedule: win
      ? [
          { date: "2026-10-17", start: win.open, end: win.close, title: "Open", type: "ritual" },
        ]
      : [],
  };
}

describe("geo", () => {
  itBA("haversine: Milpitas to Newark ~12-14 mi", () => {
    const d = haversineMi(iccMilpitas, newarkPavilion);
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(16);
  });
  it("haversine: zero distance", () => {
    expect(haversineMi(iccMilpitas, iccMilpitas)).toBe(0);
  });
  it("driveTime: short hop >= 5 min", () => {
    expect(driveTimeMin(0.5)).toBe(5);
  });
  it("driveTime: increases with distance", () => {
    expect(driveTimeMin(20)).toBeGreaterThan(driveTimeMin(5));
  });
});

describe("planner helpers", () => {
  it("hmToMin", () => {
    expect(hmToMin("10:30")).toBe(630);
    expect(hmToMin("00:00")).toBe(0);
  });
  it("minToHm roundtrip", () => {
    expect(minToHm(hmToMin("09:45"))).toBe("09:45");
  });
  itBA("openWindow from schedule", () => {
    const p = pujas.find((x) => x.id === "sanskriti")!;
    const w = openWindow(p, "2026-10-10");
    expect(w).not.toBeNull();
    expect(w!.open).toBe(hmToMin("10:30"));
    expect(w!.close).toBe(hmToMin("22:00"));
  });
  itBA("openWindow null when no events and no hours", () => {
    const p = pujas.find((x) => x.id === "aadya")!;
    expect(openWindow(p, "2026-10-10")).toBeNull();
  });
  itBA("openWindow prefers organizer hours over schedule", () => {
    const p = pujas.find((x) => x.id === "abahan")!;
    const w = openWindow(p, "2026-10-10");
    expect(w).not.toBeNull();
    expect(w!.open).toBe(hmToMin("17:00"));
    expect(w!.close).toBe(hmToMin("21:00"));
  });
});

describe("planParikroma", () => {
  it("produces ordered feasible stops", () => {
    const a = fakePuja("a", iccMilpitas, { open: "10:00", close: "21:00" });
    const b = fakePuja("b", newarkPavilion, { open: "10:00", close: "21:00" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: [],
      candidates: [a, b],
    });
    expect(res.stops.map((s) => s.puja.id)).toEqual(["a", "b"]);
    // arrive at first stop = drive time from origin
    expect(res.stops[0].arrive).toBeGreaterThan(0);
    // depart - visitStart = dwell
    const s0 = res.stops[0];
    expect(s0.depart - Math.max(s0.arrive, hmToMin("10:00"))).toBe(60);
    expect(res.totalDriveMi).toBeGreaterThan(0);
  });

  it("skips puja that closes too early", () => {
    const a = fakePuja("a", iccMilpitas, { open: "08:00", close: "10:30" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: [],
      candidates: [a],
    });
    expect(res.stops.length).toBe(0);
    expect(res.skipped.length).toBe(1);
  });

  it("must-visit scheduled before nearer optional puja", () => {
    const near = fakePuja("near", { lat: 37.4, lng: -121.9 }, { open: "10:00", close: "21:00" });
    const far = fakePuja("far", { lat: 37.7, lng: -122.05 }, { open: "10:00", close: "21:00" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: { lat: 37.4, lng: -121.9 },
      dwellMin: 45,
      mustVisit: ["far"],
      candidates: [near, far],
    });
    expect(res.stops[0].puja.id).toBe("far");
    expect(res.stops[0].isMustVisit).toBe(true);
    expect(res.stops.some((s) => s.puja.id === "near")).toBe(true);
  });

  itBA("real data: Oct 17 within one day visits multiple pujas", () => {
    const active = pujas.filter((p) => p.dates.some((d) => d.date === "2026-10-17"));
    expect(active.length).toBeGreaterThan(3);
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "09:00",
      endTime: "21:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: [],
      candidates: active,
    });
    expect(res.stops.length).toBeGreaterThanOrEqual(2);
    // monotonic departures
    for (let i = 1; i < res.stops.length; i++) {
      expect(res.stops[i].depart).toBeGreaterThan(res.stops[i - 1].depart);
    }
  });

  itBA("flags must-visit not active on date", () => {
    const a = fakePuja("a", iccMilpitas, { open: "10:00", close: "20:00" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: ["utsab"],
      candidates: [a],
    });
    expect(res.skipped.some((s) => s.puja.id === "utsab" && s.reason.includes("Not active"))).toBe(true);
  });

  it("far origin → mile-accurate skip reasons; never silent-zero without flag", () => {
    const tokyo = { lat: 35.68, lng: 139.69 }; // truly unreachable
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "09:00",
      endTime: "20:00",
      origin: tokyo,
      dwellMin: 45,
      mustVisit: [],
      candidates: pujas.filter((p) => p.dates.some((d) => d.date === "2026-10-17")),
    });
    // Tokyo: nothing reachable in a day
    expect(res.stops.length).toBe(0);
    expect(res.diagnostics.originTooFar).toBe(true);
    expect(res.diagnostics.nearestPujaMi).toBeGreaterThan(75);
    expect(res.skipped[0].reason).toMatch(/mi away/);
  });

  it("moderately far origin (LA) → either stops or flag, skip reasons carry miles", () => {
    const la = { lat: 34.05, lng: -118.24 };
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "09:00",
      endTime: "20:00",
      origin: la,
      dwellMin: 45,
      mustVisit: [],
      candidates: pujas.filter((p) => p.dates.some((d) => d.date === "2026-10-17")),
    });
    // invariant: a zero-stop result is always explained
    if (res.stops.length === 0) {
      expect(res.diagnostics.originTooFar).toBe(true);
    }
    expect(res.skipped.every((s) => s.reason.includes("mi away") || s.reason.includes("Closes"))).toBe(true);
  });

  it("metro-center origin, wide window → never zero stops", () => {
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "09:00",
      endTime: "20:00",
      origin: { ...cityCenter },
      dwellMin: 45,
      mustVisit: [],
      candidates: pujas.filter((p) => p.dates.some((d) => d.date === "2026-10-17")),
    });
    expect(res.stops.length).toBeGreaterThanOrEqual(1);
    expect(res.diagnostics.originTooFar).toBe(false);
  });

  it("closes-before-start skip reason carries times", () => {
    const early = fakePuja("early", iccMilpitas, { open: "06:00", close: "08:30" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: [],
      candidates: [early],
    });
    expect(res.skipped[0].reason).toContain("08:30");
  });
});
