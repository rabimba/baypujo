import { describe, expect, it } from "vitest";
import { haversineMi, driveTimeMin } from "./geo";
import { hmToMin, minToHm, openWindow, planParikroma } from "./planner";
import type { Puja } from "./types";
import { pujas } from "./pujas";

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
  it("haversine: Milpitas to Newark ~12-14 mi", () => {
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
  it("openWindow from schedule", () => {
    const p = pujas.find((x) => x.id === "sanskriti")!;
    const w = openWindow(p, "2026-10-10");
    expect(w).not.toBeNull();
    expect(w!.open).toBe(hmToMin("10:30"));
    expect(w!.close).toBe(hmToMin("22:00"));
  });
  it("openWindow null when no events and no hours", () => {
    const p = pujas.find((x) => x.id === "aadya")!;
    expect(openWindow(p, "2026-10-10")).toBeNull();
  });
  it("openWindow prefers organizer hours over schedule", () => {
    const p = pujas.find((x) => x.id === "abahan")!;
    const w = openWindow(p, "2026-10-10");
    expect(w).not.toBeNull();
    expect(w!.open).toBe(hmToMin("09:00"));
    expect(w!.close).toBe(hmToMin("21:30"));
  });
});

describe("planParikroma", () => {
  it("schedules selected pujas in order, respecting drive time and dwell", () => {
    const a = fakePuja("a", iccMilpitas, { open: "10:00", close: "21:00" });
    const b = fakePuja("b", newarkPavilion, { open: "10:00", close: "21:00" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: ["a", "b"],
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

  it("skips a selected puja that closes too early", () => {
    const a = fakePuja("a", iccMilpitas, { open: "08:00", close: "10:30" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: ["a"],
      candidates: [a],
    });
    expect(res.stops.length).toBe(0);
    expect(res.skipped.length).toBe(1);
  });

  it("must-visit ordering survives a tight-deadline must stranded behind a nearer slack-rich must", () => {
    // "flexible" is at origin (0 mi, wide 10:00-20:00 window).
    // "urgent" is 22.3mi away (39 min drive) with an 11:20 close.
    // Nearest-first-among-musts visits flexible first (0 mi) -> arrives at
    // urgent at 11:14, departs 11:44 (30 min dwell) -> 11:44 > 11:20 close:
    // urgent is infeasible. Visiting urgent FIRST (the only feasible order)
    // makes both fit. The planner must find that order, not drop urgent.
    const flexible = fakePuja("flexible", { lat: 37.4, lng: -121.9 }, { open: "10:00", close: "20:00" });
    const urgent = fakePuja("urgent", { lat: 37.7, lng: -122.05 }, { open: "10:00", close: "11:20" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: { lat: 37.4, lng: -121.9 },
      dwellMin: 30,
      mustVisit: ["flexible", "urgent"],
      candidates: [flexible, urgent],
    });
    expect(res.stops.map((s) => s.puja.id)).toEqual(["urgent", "flexible"]);
    expect(res.skipped).toEqual([]);
  });

  it("plan contains only the pujas the user selected — nothing auto-added", () => {
    const active = pujas.filter((p) => p.dates.some((d) => d.date === "2026-10-17"));
    expect(active.length).toBeGreaterThan(5); // plenty of other candidates available
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "09:00",
      endTime: "21:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: ["pashchimi", "aparajita"],
      candidates: active,
    });
    const mentioned = [
      ...res.stops.map((s) => s.puja.id),
      ...res.skipped.map((s) => s.puja.id),
    ];
    expect(mentioned.length).toBeGreaterThan(0);
    for (const id of mentioned) {
      expect(["pashchimi", "aparajita"]).toContain(id);
    }
  });

  it("no selection -> empty plan, not an auto-filled one", () => {
    const active = pujas.filter((p) => p.dates.some((d) => d.date === "2026-10-17"));
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "09:00",
      endTime: "21:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: [],
      candidates: active,
    });
    expect(res.stops).toEqual([]);
    expect(res.skipped).toEqual([]);
  });

  it("no selection from a far-away origin still isn't flagged as a bad origin", () => {
    // 0 stops here is because nothing was picked, not because the origin
    // reading looks wrong -- the banner shouldn't fire with nothing asked.
    const tokyo = { lat: 35.68, lng: 139.69 };
    const active = pujas.filter((p) => p.dates.some((d) => d.date === "2026-10-17"));
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "09:00",
      endTime: "21:00",
      origin: tokyo,
      dwellMin: 60,
      mustVisit: [],
      candidates: active,
    });
    expect(res.diagnostics.originTooFar).toBe(false);
  });

  it("real data: selecting several pujas on Oct 17 schedules them in order, every pick accounted for", () => {
    const active = pujas.filter((p) => p.dates.some((d) => d.date === "2026-10-17"));
    expect(active.length).toBeGreaterThan(3);
    const picks = active.slice(0, 3).map((p) => p.id);
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "09:00",
      endTime: "21:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: picks,
      candidates: active,
    });
    const accounted = [
      ...res.stops.map((s) => s.puja.id),
      ...res.skipped.map((s) => s.puja.id),
    ].sort();
    expect(accounted).toEqual([...picks].sort());
    for (let i = 1; i < res.stops.length; i++) {
      expect(res.stops[i].depart).toBeGreaterThan(res.stops[i - 1].depart);
    }
  });

  it("flags must-visit not active on date", () => {
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
      mustVisit: ["agomoni"],
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
      mustVisit: ["agomoni", "aparajita"],
      candidates: pujas.filter((p) => p.dates.some((d) => d.date === "2026-10-17")),
    });
    // invariant: a zero-stop result is always explained
    if (res.stops.length === 0) {
      expect(res.diagnostics.originTooFar).toBe(true);
    }
    expect(
      res.skipped.every(
        (s) =>
          s.reason.includes("mi away") ||
          s.reason.includes("Closes") ||
          s.reason.includes("Doesn't fit together"),
      ),
    ).toBe(true);
  });

  it("names the conflict when two must-visits genuinely can't both fit in one day", () => {
    // Both individually reachable (either alone fits fine), but neither
    // order gets both done before the other's close time.
    const a = fakePuja("a", { lat: 37.4, lng: -121.9 }, { open: "10:00", close: "11:00" });
    const b = fakePuja("b", { lat: 37.7, lng: -122.05 }, { open: "10:00", close: "11:20" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: { lat: 37.4, lng: -121.9 },
      dwellMin: 30,
      mustVisit: ["a", "b"],
      candidates: [a, b],
    });
    expect(res.stops).toHaveLength(0);
    expect(res.skipped).toHaveLength(2);
    for (const s of res.skipped) {
      expect(s.reason).toContain("Doesn't fit together");
      expect(s.reason).toContain("Puja a");
      expect(s.reason).toContain("Puja b");
    }
  });

  it("handles 7 must-visits (the permutation ceiling) without exploding", () => {
    const musts = Array.from({ length: 7 }, (_, i) =>
      fakePuja(
        `m${i}`,
        { lat: 37.3 + i * 0.05, lng: -122.0 + i * 0.03 },
        { open: "09:00", close: "21:00" },
      ),
    );
    const started = Date.now();
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "09:00",
      endTime: "21:00",
      origin: { lat: 37.4, lng: -121.9 },
      dwellMin: 30,
      mustVisit: musts.map((p) => p.id),
      candidates: musts,
    });
    expect(Date.now() - started).toBeLessThan(300);
    expect(res.stops).toHaveLength(7);
    expect(res.skipped).toEqual([]);
  });

  it("a lone must-visit that just doesn't fit the day gets the normal reason, not a self-conflict message", () => {
    // Opens in the evening; the user's own cutoff (20:00) is too early for
    // it regardless of any other must-visit -- there IS no "other pick"
    // here, so the message must not claim one.
    const evening = fakePuja("evening", iccMilpitas, { open: "19:30", close: "21:00" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: ["evening"],
      candidates: [evening],
    });
    expect(res.skipped).toHaveLength(1);
    expect(res.skipped[0].puja.id).toBe("evening");
    expect(res.skipped[0].reason).not.toContain("doesn't fit together");
    expect(res.skipped[0].reason).not.toContain("Doesn't fit together");
    expect(res.skipped[0].reason).toMatch(/cutoff|closing/i);
  });

  it("closes-before-start skip reason carries times", () => {
    const early = fakePuja("early", iccMilpitas, { open: "06:00", close: "08:30" });
    const res = planParikroma({
      date: "2026-10-17",
      startTime: "10:00",
      endTime: "20:00",
      origin: iccMilpitas,
      dwellMin: 60,
      mustVisit: ["early"],
      candidates: [early],
    });
    expect(res.skipped[0].reason).toContain("08:30");
  });
});
