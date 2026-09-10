import type { Metadata } from "next";
import DirectoryClient from "./DirectoryClient";

export const metadata: Metadata = {
  title: "All Bay Area Durga Pujas 2026 — filter by day, region, distance",
  description:
    "Browse every Durga Puja in the SF Bay Area: filter by date, region, rituals, bhog, free entry, and distance from you.",
};

export default function PujasPage() {
  return <DirectoryClient />;
}
