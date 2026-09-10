import { city, pujas, meta, REGION_BN, WEEKEND_LABELS } from "./pujas";

/**
 * Builds the assistant's knowledge context from the city's own data.
 * Kept deliberately compact: small models (gemma3-1b, Gemini Nano) have
 * small context windows and degrade with bloat.
 */

const MAX_PUJAS = 40;

export function pujaFacts(): Record<string, string> {
  const f: Record<string, string> = {};
  for (const p of pujas.slice(0, MAX_PUJAS)) {
    const bits: string[] = [
      `Dates: ${p.dateLabel}`,
      `Venue: ${p.venue.name}, ${p.venue.city}`,
    ];
    if (p.venue.address) bits.push(`Address: ${p.venue.address}`);
    if (p.region) bits.push(`Region: ${p.region}`);
    if (p.entry.free === true) bits.push("Entry: free");
    if (p.entry.free === false && p.entry.ticketUrl) {
      bits.push(`Entry: ticketed — ${p.entry.ticketUrl}`);
    } else if (p.entry.ticketUrl) {
      bits.push(`Tickets: ${p.entry.ticketUrl}`);
    }
    if (p.bhog.available === true) bits.push("Bhog: available");
    if (p.bhog.price) bits.push(`Bhog price: ${p.bhog.price}`);
    const hl = p.highlights.slice(0, 3);
    if (hl.length) bits.push(`Highlights: ${hl.join("; ")}`);
    if (p.status === "tba") bits.push("Status: 2026 details not yet announced");
    f[p.name] = bits.join(" | ");
  }
  return f;
}

export function tithiFacts(): string {
  return meta.tithiReference
    .map((t) => `${t.date}: ${t.label}${t.labelBn ? ` (${t.labelBn})` : ""}`)
    .join("; ");
}

export function mahalayaFacts(): string {
  const m = meta.mahalaya;
  if (!m) return "";
  return `Mahalaya ${m.dateLabel}: ${m.tithi}. ${m.significance}`;
}

export function buildSystemPrompt(): string {
  const facts = pujaFacts();
  const pujaList = Object.entries(facts)
    .map(([name, f]) => `- ${name}: ${f}`)
    .join("\n");

  const regions = Object.entries(REGION_BN)
    .map(([en, bn]) => `${en} (${bn})`)
    .join(", ");

  const weekends = Object.entries(WEEKEND_LABELS)
    .map(([k, v]) => `${k === "0" ? "other dates" : `weekend ${k}`}: ${v}`)
    .join("; ");

  return [
    `You are ${city.brand}'s helpful assistant (পুজো সহায়ক) for Durga Puja ${meta.year} in ${city.cityLabel}.`,
    `Answer questions about the pujas listed below using ONLY this data. If something is not in the data, say you don't know and suggest checking the organizer's website or the site's directory page.`,
    `Reply in the language of the question — Bengali questions get Bengali answers, English gets English. Keep answers short (1-3 sentences), warm, and factual. Never invent dates, venues, prices, or artists.`,
    ``,
    `Puja calendar (${meta.year}, ${city.cityLabelShort}): ${weekends}.`,
    `Regions: ${regions}.`,
    `Tithi days: ${tithiFacts()}.`,
    mahalayaFacts(),
    ``,
    `The ${pujas.length} pujas:`,
    pujaList,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Rough token estimate (chars/4) — used to assert the prompt stays small. */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

/** True if the text contains Bengali script — routes away from Gemini Nano. */
export function hasBengali(s: string): boolean {
  return /[\u0980-\u09FF]/.test(s);
}
