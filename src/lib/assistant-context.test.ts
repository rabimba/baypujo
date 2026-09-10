import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  estimateTokens,
  hasBengali,
  isOnTopic,
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

  it("facts carry date + venue per puja (compact)", () => {
    const f = pujaFacts();
    const first = Object.values(f)[0];
    expect(first).toMatch(/Oct|TBA|Sep|Nov/);
    expect(first).toMatch(/,/); // "venue, city"
    expect(first.length).toBeLessThan(200); // one-line budget
  });

  it("system prompt contains tithi and pujas", () => {
    const sp = buildSystemPrompt();
    expect(sp).toMatch(/Tithi:/);
    expect(sp).toContain(pujas[0].name);
    expect(sp).toContain(pujas[0].venue.city);
  });

  it("system prompt stays under ~3.5k estimated tokens", () => {
    const sp = buildSystemPrompt();
    expect(estimateTokens(sp)).toBeLessThan(3500);
  });

  it("system prompt warns against hallucination", () => {
    const sp = buildSystemPrompt();
    expect(sp).toMatch(/ONLY from this data/i);
    expect(sp).toMatch(/never invent/i);
  });

  it("topic gate: on-topic questions pass", () => {
    expect(isOnTopic("Which pujas are on Ashtami weekend?")).toBe(true);
    expect(isOnTopic("When is Mahalaya?")).toBe(true);
    expect(isOnTopic("অষ্টমীতে কোথায় পুজো হবে?")).toBe(true);
    expect(isOnTopic("Where can I get bhog?")).toBe(true);
    expect(isOnTopic("What is your name?")).toBe(true);
    expect(isOnTopic("pujo kobe hobe milpitas e?")).toBe(true);
    expect(isOnTopic("Kothai pujo hochhe?")).toBe(true);
    expect(isOnTopic("bhog koto taka?")).toBe(true);
  });

  it("topic gate: off-topic questions refused locally", () => {
    expect(isOnTopic("Who won the 2018 FIFA World Cup?")).toBe(false);
    expect(isOnTopic("Write me a Python function to sort a list")).toBe(false);
    expect(isOnTopic("Write a poem about the ocean")).toBe(false);
    expect(isOnTopic("What is the capital of France?")).toBe(false);
    expect(isOnTopic("How is the stock market today?")).toBe(false);
  });

  it("persona: Kartik (haat kata) + scope fence", () => {
    const sp = buildSystemPrompt();
    expect(sp).toContain("Kartik");
    expect(sp).toContain("haat kata");
    expect(sp).toMatch(/SCOPE:/);
    expect(sp).toMatch(/only Durga Puja, this site/i);
  });

  it("language rule: Banglish answered in Bengali script", () => {
    const sp = buildSystemPrompt();
    expect(sp).toMatch(/romanized Banglish/i);
    expect(sp).toMatch(/never answer Banglish in English/i);
    // prompt must still fit the ~2.5k stall budget
    expect(sp.length).toBeLessThan(2600);
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
