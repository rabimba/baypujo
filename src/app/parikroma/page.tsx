import type { Metadata } from "next";
import ParikromaClient from "./ParikromaClient";
import { city } from "../../lib/pujas";

export const metadata: Metadata = {
  title: `Pujo Parikroma Planner — hop multiple ${city.cityLabelShort} pujas in one day`,
  description:
    `Tell us your free hours and starting point — get a mapped itinerary of which ${city.cityLabelShort} Durga Pujas to visit and when.`,
};

export default function ParikromaPage() {
  return <ParikromaClient />;
}
