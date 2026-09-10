import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  estimateTokens,
  hasBengali,
  pujaFacts,
  tithiFacts,
} from "./assistant-context";
import { CITY_ID } from "./city-data";
import { pujas } from "./pujas";

describe("assistant context", () => {
  it("includes every puja by name", () => {
    const f = pujaFacts();
    for (const p of pujas) {
      expect(f[p.name]).toBeTruthy();
    }
  });

  it("facts carry date + venue per puja", () => {
    const f = pujaFacts();
    const first = Object.values(f)[0];
    expect(first).toMatch(/Dates:/);
    expect(first).toMatch(/Venue:/);
  });

  it("system prompt contains calendar, tithi, and pujas", () => {
    const sp = buildSystemPrompt();
    expect(sp).toMatch(/Puja calendar/);
    expect(sp).toMatch(/Tithi days:/);
    expect(sp).toMatch(/Regions:/);
    expect(sp).toContain(pujas[0].name);
    expect(sp).toContain(pujas[0].venue.city);
  });

  it("system prompt stays under ~3.5k estimated tokens", () => {
    const sp = buildSystemPrompt();
    expect(estimateTokens(sp)).toBeLessThan(3500);
  });

  it("system prompt warns against hallucination + names the city", () => {
    const sp = buildSystemPrompt();
    expect(sp).toMatch(/ONLY this data|only this data/i);
    expect(sp).toMatch(/Never invent/i);
  });

  it("bengali detection", () => {
    expect(hasBengali("কোথায় পুজো?")).toBe(true);
    expect(hasBengali("hybrid বাংলা English mix")).toBe(true);
    expect(hasBengali("Where is the puja in Milpitas?")).toBe(false);
    expect(hasBengali("")).toBe(false);
  });

  it("tithi facts non-empty and dated", () => {
    const t = tithiFacts();
    expect(t).toMatch(/2026-\d{2}-\d{2}/);
  });

  it("city-branded prompt (city-agnostic test)", () => {
    const sp = buildSystemPrompt();
    // whichever city this repo builds, its own pujas must be the knowledge base
    expect(sp).toContain(CITY_ID === "bayarea" ? "Bay Area" : "Houston");
  });
});
