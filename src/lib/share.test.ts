import { describe, expect, it } from "vitest";
import {
  buildShareQuery,
  buildShareText,
  buildShareTextCompact,
  parseShareQuery,
} from "./share";
import { planParikroma } from "./planner";
import { pujas, city } from "./pujas";

// City-driven fixture: origin near the metro center, the busiest festival
// date, and a must-visit sample slug from city.json.
const origin = { ...city.center };
const date = city.sampleSlugs.plannerMust[0] === "hdbs" ? "2026-10-17" : "2026-10-17";
const must = city.sampleSlugs.plannerMust[0];
const candidates = pujas.filter((p) => p.dates.some((d) => d.date === date));

const result = planParikroma({
  date,
  startTime: "10:00",
  endTime: "20:00",
  origin,
  dwellMin: 60,
  mustVisit: [must],
  candidates,
});

const ctx = {
  date,
  startTime: "10:00",
  endTime: "20:00",
  dwellMin: 60,
  result,
  originLabel: "origin",
};

describe("share text", () => {
  it("full text: header, every stop, totals, brand line", () => {
    const t = buildShareText(ctx, `https://rabimba.github.io/${city.repoName}`);
    expect(t).toContain("পুজো পরিক্রমা — Pujo Parikrama Plan");
    expect(t).toContain("Saturday, October 17");
    expect(t).toContain("Free 10:00–20:00 · 60 min per pujo · from origin");
    for (const s of result.stops) {
      expect(t).toContain(s.puja.name);
      expect(t).toContain(s.puja.venue.city);
    }
    expect(t).toMatch(/\d+ pujas · \d+ mi · \d+h/);
    expect(t).toContain(
      `planned on ${city.brand} (rabimba.github.io/${city.repoName})`,
    );
  });

  it("brand line always present, host-less fallback", () => {
    const t = buildShareText(ctx);
    expect(t.trimEnd().endsWith(`planned on ${city.brand}`)).toBe(true);
  });

  it("full text: must-visit first + drive hints", () => {
    const t = buildShareText(ctx);
    expect(t.indexOf(pujas.find((p) => p.id === must)!.name)).toBeLessThan(
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
    const full = buildShareText(ctx, "https://rabimba.github.io");
    const compact = buildShareTextCompact(ctx, "https://rabimba.github.io");
    expect(compact.length).toBeLessThan(full.length);
    expect(compact.split("\n").length).toBe(result.stops.length + 2); // head + stops + brand
    expect(compact).toContain("1. 10:");
    expect(compact).toContain(`planned on ${city.brand}`);
  });
});

describe("share link", () => {
  it("query roundtrip preserves plan inputs", () => {
    const q = buildShareQuery({
      date,
      start: "09:00",
      end: "21:00",
      dwell: 45,
      must: city.sampleSlugs.plannerMust,
      lat: origin.lat,
      lng: origin.lng,
      label: "origin",
    });
    const parsed = parseShareQuery(new URLSearchParams(q))!;
    expect(parsed.date).toBe(date);
    expect(parsed.start).toBe("09:00");
    expect(parsed.end).toBe("21:00");
    expect(parsed.dwell).toBe(45);
    expect(parsed.must).toEqual(city.sampleSlugs.plannerMust);
    expect(parsed.lat).toBeCloseTo(origin.lat, 4);
    expect(parsed.lng).toBeCloseTo(origin.lng, 4);
    expect(parsed.label).toBe("origin");
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
      must: [must],
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
