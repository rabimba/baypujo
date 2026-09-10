import rawData from "../../data/pujas.json";
import type { CulturalProgram, Puja, PujoData, Region, WeekendTab } from "./types";

export const data = rawData as PujoData;
export const pujas = data.pujas;
export const meta = data.meta;

export const REGIONS: Region[] = [
  "East Bay",
  "South Bay",
  "Tri-Valley",
  "Central Valley",
  "Sacramento",
  "Peninsula",
];

export const REGION_COLORS: Record<Region, string> = {
  "East Bay": "#e11d48",
  "South Bay": "#2563eb",
  "Tri-Valley": "#d97706",
  "Central Valley": "#16a34a",
  Sacramento: "#7c3aed",
  Peninsula: "#0891b2",
};

export const REGION_BN: Record<Region, string> = {
  "East Bay": "পূর্ব উপসাগর",
  "South Bay": "দক্ষিণ উপসাগর",
  "Tri-Valley": "ট্রাই-ভ্যালি",
  "Central Valley": "মধ্য উপত্যকা",
  Sacramento: "স্যাক্রামেন্টো",
  Peninsula: "উপদ্বীপ",
};

const TITHI_BN: Record<string, string> = {
  "2026-10-16": "ষষ্ঠী",
  "2026-10-17": "সপ্তমী",
  "2026-10-18": "অষ্টমী",
  "2026-10-19": "নবমী",
  "2026-10-20": "দশমী",
};

/** Bengali tithi name for a date, if it is a tithi day. */
export function tithiBn(date: string): string | null {
  return TITHI_BN[date] ?? null;
}

/** Bengali renderings for common schedule event titles. */
const EVENT_BN: { re: RegExp; bn: string }[] = [
  { re: /pushpanjali/i, bn: "পুষ্পাঞ্জলি" },
  { re: /sandhi/i, bn: "সন্ধিপূজা" },
  { re: /dhunuchi/i, bn: "ধুনুচি নাচ" },
  { re: /sindur khela|sindur/i, bn: "সিঁদুর খেলা" },
  { re: /bhog/i, bn: "ভোগ" },
  { re: /arati|aarati/i, bn: "আরতি" },
  { re: /bodhon/i, bn: "বোধন" },
  { re: /sandhya/i, bn: "সন্ধ্যা" },
  { re: /homa/i, bn: "হোম" },
  { re: /kumari/i, bn: "কুমারীপূজা" },
  { re: /chandi/i, bn: "চণ্ডীপাঠ" },
  { re: /visarjan|bisharjan|bisarjan/i, bn: "বিসর্জন" },
  { re: /dandiya/i, bn: "ডান্ডিয়া" },
  { re: /dashami/i, bn: "দশমী" },
  { re: /nabami|navami/i, bn: "নবমী" },
  { re: /ashtami|asthami/i, bn: "অষ্টমী" },
  { re: /saptami/i, bn: "সপ্তমী" },
  { re: /shashthi|shashti/i, bn: "ষষ্ঠী" },
];

/** Bengali short label for an event title, or null. */
export function eventBn(title: string): string | null {
  const hit = EVENT_BN.find((e) => e.re.test(title));
  return hit ? hit.bn : null;
}

export const WEEKEND_LABELS: Record<string, string> = {
  "1": "Weekend 1 · Oct 9–11",
  "2": "Weekend 2 · Oct 16–18",
  "3": "Weekend 3 · Oct 23–25",
};

export function getPuja(id: string): Puja | undefined {
  return pujas.find((p) => p.id === id);
}

export function pujasByWeekend(tab: WeekendTab): Puja[] {
  if (tab === "all") return pujas;
  if (tab === "tba") return pujas.filter((p) => p.weekend === null);
  const n = Number(tab);
  return pujas.filter((p) => p.weekend === n);
}

export function pujasOnDate(date: string): Puja[] {
  return pujas.filter((p) => p.dates.some((d) => d.date === date));
}

export function scheduleOn(puja: Puja, date: string) {
  return puja.schedule
    .filter((e) => e.date === date)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function scheduleDates(puja: Puja): string[] {
  return [...new Set(puja.schedule.map((e) => e.date))].sort();
}

export function fmtTime(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function fmtDate(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function fmtDateLong(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function mapsUrl(puja: Puja): string {
  const q = encodeURIComponent(
    [puja.venue.name, puja.venue.address, puja.venue.city, "CA"]
      .filter(Boolean)
      .join(" "),
  );
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Organizer-published hours for a date, if any. */
export function hoursOn(puja: Puja, date: string) {
  return (puja.hours ?? []).find((h) => h.date === date) ?? null;
}

/** Cultural programs on a date (or all, sorted by date+time). */
export function programsOn(puja: Puja, date?: string) {
  const list = puja.culturalPrograms.filter((c) =>
    date ? c.date === date : true,
  );
  return list.sort((a, b) =>
    `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`),
  );
}

/** Best-effort clock time for a cultural program ("21:00" | "9:00 PM" → minutes). */
export function programTimeMin(c: CulturalProgram): number | null {
  if (!c.time) return null;
  const m24 = c.time.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) return Number(m24[1]) * 60 + Number(m24[2]);
  const m12 = c.time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = Number(m12[1]);
    if (/pm/i.test(m12[3]) && h !== 12) h += 12;
    if (/am/i.test(m12[3]) && h === 12) h = 0;
    return h * 60 + Number(m12[2]);
  }
  const mOnly = c.time.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (mOnly) {
    let h = Number(mOnly[1]);
    if (/pm/i.test(mOnly[2]) && h !== 12) h += 12;
    if (/am/i.test(mOnly[2]) && h === 12) h = 0;
    return h * 60;
  }
  return null;
}

export const ALL_FESTIVAL_DATES: string[] = [
  "2026-10-09",
  "2026-10-10",
  "2026-10-11",
  "2026-10-16",
  "2026-10-17",
  "2026-10-18",
  "2026-10-19",
  "2026-10-20",
  "2026-10-23",
  "2026-10-24",
  "2026-10-25",
];
