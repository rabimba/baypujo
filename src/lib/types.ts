export type EventType = "ritual" | "cultural" | "food";

export interface ScheduleEvent {
  date: string; // ISO date "2026-10-16"
  start: string | null; // "HH:MM" 24h, null = time TBA
  end: string | null;
  title: string;
  type: EventType;
}

export interface BhogInfo {
  available: boolean | null;
  price: string | null;
  details: string | null;
  purchaseUrl?: string;
}

export interface EntryInfo {
  free: boolean | null;
  ticketUrl: string | null;
  notes: string | null;
}

/** A named cultural performance (artist night, drama, fashion show…). */
export interface CulturalProgram {
  title: string;
  date: string; // ISO date
  time: string | null; // "21:00" or human string like "9:00 PM"
  artist: string | null;
  description: string | null;
  ticketUrl?: string;
  free?: boolean | null; // null = unknown
}

/** Organizer / ticketing contact. */
export interface Contact {
  email?: string;
  phone?: string;
  notes?: string; // e.g. "Text or WhatsApp only"
}

/** Time window a puja is open on a given date (from organizer or default). */
export interface HoursWindow {
  date: string;
  open: string; // "HH:MM"
  close: string; // "HH:MM"
  source: "organizer" | "default";
}

export interface Venue {
  name: string;
  address: string | null;
  city: string;
  lat: number;
  lng: number;
  coordsApprox?: boolean;
}

export interface PujaDate {
  date: string;
}

export interface Puja {
  id: string;
  name: string;
  organizer: string;
  region: Region;
  weekend: number | null; // 1, 2, 3, 0 = other published date, null = TBA
  dates: PujaDate[];
  dateLabel: string;
  description: string;
  venue: Venue;
  schedule: ScheduleEvent[];
  /** Published opening hours per day (used by planner when no schedule). */
  hours?: HoursWindow[];
  culturalPrograms: CulturalProgram[];
  bhog: BhogInfo;
  entry: EntryInfo;
  contact: Contact;
  /** Organizer notices, e.g. "online bhog sales closed, buy at venue". */
  notices: string[];
  links: {
    website?: string;
    facebook?: string;
    tickets?: string;
  };
  highlights: string[];
  status: "verified" | "partial" | "tba";
}

export type Region =
  | "East Bay"
  | "South Bay"
  | "Tri-Valley"
  | "Central Valley"
  | "Sacramento"
  | "Peninsula";

export interface MahalayaInfo {
  date: string; // ISO date
  dateLabel: string;
  tithi: string;
  title: string;
  significance: string;
  mahishasuramardini: string;
  tarpan: string;
}

export interface PujoData {
  meta: {
    year: number;
    lastVerified: string;
    tithiReference: { date: string; label: string }[];
    mahalaya?: MahalayaInfo;
    sourceNote: string;
  };
  pujas: Puja[];
}

export type WeekendTab = "all" | "1" | "2" | "3" | "tba";

export interface LatLng {
  lat: number;
  lng: number;
}

export type EntryFilter = "all" | "free" | "paid" | "unknown";
export type EventTypeFilter = "all" | EventType;
