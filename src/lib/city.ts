// Reads site.config.json (committed per-repo) — the ONLY file that differs
// between city repos. PB_CITY env overrides for local multi-city dev/builds.
import { readFileSync } from "node:fs";
import path from "node:path";

export interface CityConfig {
  id: string;
  brand: string;
  brandBn: string;
  taglineBn: string;
  heroKickerBn: string;
  cityLabel: string; // "the Bay Area" (used mid-sentence)
  cityLabelShort: string; // "Bay Area"
  metaTitle: string;
  metaDescription: string;
  repoName: string;
  dataRepoUrl: string;
  ownerUrl: string;
  center: { lat: number; lng: number };
  zoom: number;
  warnRadiusMi: number;
  driveParams: { roadFactor: number; speedsMph: number[] };
  regions: { id: string; color: string; bn: string }[];
  weekendLabels: Record<string, string>;
  festivalDates: string[];
  sampleSlugs: { detail: string; sitemap: string; plannerMust: string[] };
}

export interface SiteConfig {
  city: string;
}

export function resolveCity(): string {
  const env = process.env.PB_CITY;
  if (env) return env;
  try {
    const raw = readFileSync(
      path.join(process.cwd(), "site.config.json"),
      "utf-8",
    );
    return (JSON.parse(raw) as SiteConfig).city;
  } catch {
    throw new Error(
      "site.config.json missing or unreadable — commit { \"city\": \"<id>\" } or set PB_CITY",
    );
  }
}

export function loadCity(id: string): CityConfig {
  const raw = readFileSync(
    path.join(process.cwd(), "data", "cities", id, "city.json"),
    "utf-8",
  );
  return JSON.parse(raw) as CityConfig;
}
