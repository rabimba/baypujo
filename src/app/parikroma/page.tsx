import type { Metadata } from "next";
import ParikromaClient from "./ParikromaClient";

export const metadata: Metadata = {
  title: "Pujo Parikroma Planner — hop multiple Bay Area pujas in one day",
  description:
    "Tell us your free hours and starting point — get a mapped itinerary of which Bay Area Durga Pujas to visit and when.",
};

export default function ParikromaPage() {
  return <ParikromaClient />;
}
