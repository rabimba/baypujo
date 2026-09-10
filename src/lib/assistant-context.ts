import { city, pujas, meta } from "./pujas";

/**
 * Builds the assistant's knowledge context from the city's own data.
 * Kept deliberately compact: small models (gemma3-1b, Gemini Nano) have
 * small context windows and degrade with bloat.
 */

const MAX_PUJAS = 40;
/** Empirical WebLLM 0.2.85 + Qwen3-1.7B WebGPU ceiling: system prompts much
 *  beyond ~2.5k chars stall generation mid-stream. Budget the whole prompt. */
const MAX_SYSTEM_CHARS = 2500;

export function pujaFacts(): Record<string, string> {
  const f: Record<string, string> = {};
  for (const p of pujas.slice(0, MAX_PUJAS)) {
    // Compact single line — the 4096-token context must hold system +
    // Qwen3's internal think block + answer, so every char counts.
    const bits: string[] = [p.dateLabel, `${p.venue.name}, ${p.venue.city}`];
    if (p.entry.free === true) bits.push("free entry");
    else if (p.entry.free === false) bits.push("ticketed");
    if (p.bhog.available === true) bits.push("bhog");
    if (p.bhog.price) bits.push(`bhog ${p.bhog.price}`);
    const hl = p.highlights.slice(0, 2);
    if (hl.length) bits.push(hl.join("; "));
    if (p.status === "tba") bits.push("2026 TBA");
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

  const head = [
    `You are Kartik (কার্তিক), "haat kata Kartik" — Durga Puja ${meta.year} assistant for ${city.cityLabelShort} on ${city.brand}.`,
    `SCOPE: only Durga Puja, this site, and these pujas. Refuse anything else in one line. Answer ONLY from this data; unknown → say so. 1-3 sentences, never invent details.`,
    `LANGUAGE: reply in simple Bengali script (সহজ বাংলায়) when the question is in Bengali OR romanized Banglish (e.g. "kothai pujo hochhe") — never answer Banglish in English or broken Bengali. English questions get English. Venue/proper names stay in English.`,
    `Tithi: ${tithiFacts()}.`,
    mahalayaFacts(),
  ]
    .filter(Boolean)
    .join("\n");

  // Fit the pujas list into the remaining char budget; confirmed-date
  // pujas first, TBA last, until the budget is exhausted.
  const entries = Object.entries(pujaFacts());
  const withDates = entries.filter(([, f]) => !f.includes("TBA"));
  const tba = entries.filter(([, f]) => f.includes("TBA"));
  const budget = MAX_SYSTEM_CHARS - head.length - 30;
  const kept: string[] = [];
  let used = 0;
  let listed = 0;
  for (const [name, f] of [...withDates, ...tba]) {
    const line = `- ${name}: ${f}`;
    if (used + line.length > budget && kept.length > 0) continue;
    kept.push(line);
    used += line.length + 1;
    listed++;
    if (used > budget) break;
  }
  return `${head}\nPujas (${listed} of ${pujas.length}):\n${kept.join("\n")}`;
}

/** Rough token estimate (chars/4) — used to assert the prompt stays small. */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

/** True if the text contains Bengali script — routes away from Gemini Nano. */
export function hasBengali(s: string): boolean {
  return /[\u0980-\u09FF]/.test(s);
}

/**
 * Deterministic topic gate — runs BEFORE any model call.
 * Bengali script always passes (the site's audience; Bengali chit-chat
 * variants are rarer and the model's own fence handles the rest).
 * Returns false only for clearly-off-site English questions.
 */
const ON_TOPIC = [
  // romanized bangla question words + puja/festival vocabulary (en + banglish)
  /kothai|kotha|kobe|kakhono|keno|ki(?: |$)|hobe|hochhe|hocche|korbo|koren|achen|ache\b/i,
  /puja|pujo|pooja|puj(a|o)\b/i,
  /durga|durgo|maa\b|protima|pandal|pandol/i,
  /ashtami|astami|saptami|shashthi|shashti|navami|nabami|dashami|doshami|dashomi/i,
  /mahalaya|bodhon|anandamela|ananda mela|sindoor|sindur|shindur|dhunuchi|sandhi|pushpanjali|anjali|bhog|arati|aarti|aroti|kumari|chandi|visarjan|bijoya|borsha|bisarjan/i,
  /kali|lakshmi|laksmi|saraswati|shoroshshoti|devi|goddess|lakshmi puja|kali puja/i,
  // site vocabulary
  /parikrama|parikroma|route|planner|itinerary|schedule|venue|ticket|bhog|prasad|khichuri|food|directions|map\b|weekend|region|directory|milpitas|fremont|sunnyvale|san jose|san ramon|dublin|pleasanton|hayward|oakland|berkeley|sacramento|folsom|cupertino|santa clara|palo alto|mountain view|campbell|houston|sugar land|katy|cypress|brookshire|hillcroft/i,
  /kumari|tithi|panjika|panchang|calendar|october|bijoya|shubho|shuvo|shubha|utsav|sarbajanin|sarbojanin|boishakh|noboborsho|prabasi|probashee|mela|mela\b/i,
  /pratidin|protidin/i,
];

const OFF_TOPIC_HINTS = [
  /world cup|fifa|cricket|football match|nba|super bowl/i,
  /write (me |a )?(poem|story|essay|song)|write code|python|javascript|java program|c\+\+|sql|regex/i,
  /capital of|president of|prime minister|who invented|history of (the )?(world|america|india)|weather (in|today)|stock (market|price)|recipe for (cake|pasta)|homework|math problem|solve.*equation/i,
];

/** Site/meta questions the assistant legitimately handles. */
const SELF_TOPIC = [
  /your name|who are you|what are you|কার্তিক|kartik|haat kata|assistant|how do you work|are you (an? )?(ai|robot|bot)/i,
];

export function isOnTopic(q: string): boolean {
  if (hasBengali(q)) return true;
  if (SELF_TOPIC.some((re) => re.test(q))) return true;
  if (ON_TOPIC.some((re) => re.test(q))) return true;
  // clearly-known off-topic patterns with no on-topic signal → refuse
  if (OFF_TOPIC_HINTS.some((re) => re.test(q))) return false;
  // unknown zone: let the model + its fence decide
  return true;
}

/** The canned refusal — never generated, always identical. */
export const OFF_TOPIC_REPLY =
  "I'm Kartik — haat kata Kartik, your Durga Puja companion! I only chat about Durga Puja, this site's pujas, schedules, bhog, and the parikroma planner. Ask me something about the pujas 🙏";
