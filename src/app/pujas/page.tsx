import type { Metadata } from "next";
import DirectoryClient from "./DirectoryClient";
import { city } from "../../lib/pujas";

export const metadata: Metadata = {
  title: `All ${city.cityLabelShort} Durga Pujas 2026 — filter by day, region, distance`,
  description:
    `Browse every Durga Puja in ${city.cityLabelShort}: filter by date, region, rituals, bhog, free entry, and distance from you.`,
};

export default function PujasPage() {
  return <DirectoryClient />;
}
