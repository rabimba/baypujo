import { describe, expect, it } from "vitest";
import {
  buildShareQuery,
  buildShareText,
  buildShareTextCompact,
  parseShareQuery,
} from "./share";
import { planParikroma } from "./planner";
import { pujas } from "./pujas";

const origin = { lat: 37.4319231, lng: -121.8952529 }; // ICC Milpitas
const date = "2026-10-17";
const candidates = pujas.filter((p) => p.dates.some((d) => d.date === date));

const result = planParikroma({
  date,
  startTime: "10:00",
  endTime: "20:00",
  origin,
  dwellMin: 60,
  mustVisit: ["pashchimi"],
  candidates,
});

const ctx = {
  date,
  startTime: "10:00",
  endTime: "20:00",
  dwellMin: 60,
  result,
  originLabel: "Milpitas",
};

describe("share text", () => {
  it("full text: header, every stop, totals, brand line", () => {
    const t = buildShareText(ctx, "https://rkaranjai.github.io/pujo-parikrama");
    expect(t).toContain("পুজো পরিক্রমা — Pujo Parikrama Plan");
    expect(t).toContain("Saturday, October 17");
    expect(t).toContain("Free 10:00–20:00 · 60 min per pujo · from Milpitas");
    for (const s of result.stops) {
      expect(t).toContain(s.puja.name);
      expect(t).toContain(s.puja.venue.city);
    }
    expect(t).toMatch(/\d+ pujas · \d+ mi · \d+h/);
    expect(t).toContain(
      "planned on Bay Area Pujo Parikrama (rkaranjai.github.io/pujo-parikrama)",
    );
  });

  it("brand line always present, host-less fallback", () => {
    const t = buildShareText(ctx);
    expect(t.trimEnd().endsWith("planned on Bay Area Pujo Parikrama")).toBe(true);
  });

  it("full text: must-visit first + drive hints", () => {
    const t = buildShareText(ctx);
    expect(t.indexOf("Pashchimi")).toBeLessThan(
      t.indexOf("2. ") === -1 ? Infinity : t.indexOf("2. "),
    );
    expect(t).toContain("min drive from previous");
  });

  it("full text: empty plan handled", () => {
    const empty = planParikroma({
      date,
      startTime: "13:00",
      endTime: "14:00",
      origin,
      dwellMin: 60,
      mustVisit: [],
      candidates,
    });
    const t = buildShareText({ ...ctx, result: empty });
    expect(t).toContain("No pujas fit this window");
  });

  it("compact text: one line per stop + brand, shorter than full", () => {
    const full = buildShareText(ctx, "https://rkaranjai.github.io");
    const compact = buildShareTextCompact(ctx, "https://rkaranjai.github.io");
    expect(compact.length).toBeLessThan(full.length);
    expect(compact.split("\n").length).toBe(result.stops.length + 2); // head + stops + brand
    expect(compact).toContain("1. 10:");
    expect(compact).toContain("planned on Bay Area Pujo Parikrama");
  });
});

describe("share link", () => {
  it("query roundtrip preserves plan inputs", () => {
    const q = buildShareQuery({
      date,
      start: "09:00",
      end: "21:00",
      dwell: 45,
      must: ["pashchimi", "sanskriti"],
      lat: 37.43192,
      lng: -121.89525,
      label: "ICC Milpitas",
    });
    const parsed = parseShareQuery(new URLSearchParams(q))!;
    expect(parsed.date).toBe(date);
    expect(parsed.start).toBe("09:00");
    expect(parsed.end).toBe("21:00");
    expect(parsed.dwell).toBe(45);
    expect(parsed.must).toEqual(["pashchimi", "sanskriti"]);
    expect(parsed.lat).toBeCloseTo(37.43192, 4);
    expect(parsed.lng).toBeCloseTo(-121.89525, 4);
    expect(parsed.label).toBe("ICC Milpitas");
  });

  it("no date → null (not a share link)", () => {
    expect(parseShareQuery(new URLSearchParams("start=09:00"))).toBeNull();
  });

  it("prefilled params reproduce the same itinerary", () => {
    const q = buildShareQuery({
      date,
      start: "10:00",
      end: "20:00",
      dwell: 60,
      must: ["pashchimi"],
      lat: origin.lat,
      lng: origin.lng,
    });
    const p = parseShareQuery(new URLSearchParams(q))!;
    const rerun = planParikroma({
      date: p.date,
      startTime: p.start,
      endTime: p.end,
      origin: { lat: p.lat!, lng: p.lng! },
      dwellMin: p.dwell,
      mustVisit: p.must,
      candidates: pujas.filter((x) => x.dates.some((d) => d.date === p.date)),
    });
    expect(rerun.stops.map((s) => s.puja.id)).toEqual(
      result.stops.map((s) => s.puja.id),
    );
  });
});
