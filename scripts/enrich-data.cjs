#!/usr/bin/env node
/* Enrich data/pujas.json with scraped organizer info. Surgical patch. */
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "data", "pujas.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const byId = Object.fromEntries(data.pujas.map((p) => [p.id, p]));

// default fields every puja now carries
for (const p of data.pujas) {
  p.culturalPrograms ??= [];
  p.contact ??= {};
  p.notices ??= [];
  p.hours ??= [];
}

function patch(id, upd) {
  const p = byId[id];
  if (!p) throw new Error("unknown id " + id);
  Object.assign(p, upd);
}

const T = (date, start, end, title, type) => ({ date, start, end, title, type });

// ---- Abahan (own site: zeffy ticketing, contacts, food partners) ----
patch("abahan", {
  schedule: [
    T("2026-10-10", "17:00", "21:00", "Puja, pushpanjali, arati & cultural evening", "ritual"),
    T("2026-10-11", "10:00", "20:00", "Saptami–Dashami rituals, bhog, cultural programs", "ritual"),
  ],
  hours: [
    { date: "2026-10-10", open: "17:00", close: "21:00", source: "organizer" },
    { date: "2026-10-11", open: "10:00", close: "20:00", source: "organizer" },
  ],
  bhog: {
    available: true,
    price: null,
    details: "Food partners on site: The Char House, Snehlata Misti Bari, ChaiAum. Bhog and offerings via the Pujo support page.",
    purchaseUrl: "https://www.zeffy.com/en-US/ticketing/durga-puja--2026",
  },
  entry: {
    free: true,
    ticketUrl: "https://www.zeffy.com/en-US/ticketing/durga-puja--2026",
    notes: "Entry free; sponsorships, offerings and vendor options via Zeffy.",
  },
  contact: {
    email: "Info@abahanbayarea.org",
    phone: "+1 (585) 635-8443",
  },
  notices: ["Vendor and volunteer signups are currently closed."],
  highlights: ["First-year puja", "ICC Milpitas venue", "Food & merchandise partners on site"],
});

// ---- Aadya (theme Panchatatva; social links) ----
patch("aadya", {
  culturalPrograms: [],
  contact: {},
  links: {
    website: "https://www.aadyatogether.org/",
    facebook: "https://www.facebook.com/profile.php?id=61577757260905",
  },
  highlights: ["5th anniversary — Panchatatva theme", "Cultural programs & bhog team"],
  notices: [],
});

// ---- MitraUSA (Navaratri & Durga Puja Oct 9–11, contacts) ----
patch("mitra", {
  contact: { email: "info@mitra-usa.org" },
  links: {
    website: "https://mitra-usa.org/",
    facebook: "https://www.facebook.com/Mitraofusa/",
  },
  dateLabel: "Oct 9–11, 2026 (Navaratri & Durga Puja)",
  notices: [],
});

// ---- Muktangan (Navrang dandiya Oct 9 + DP Oct 10–11; contacts; schedule coming soon) ----
patch("muktangan", {
  dateLabel: "Oct 9–11, 2026 (Navrang Dandiya Oct 9; Durga Puja Oct 10–11)",
  culturalPrograms: [
    {
      title: "Navrang — A Dandiya Saga",
      date: "2026-10-09",
      time: null,
      artist: null,
      description: "Dandiya night opening the festival weekend.",
    },
    {
      title: "Evening with international bands",
      date: null,
      time: null,
      artist: null,
      description: "All-time favorite international bands evening (details coming soon).",
    },
  ],
  hours: [
    { date: "2026-10-10", open: "10:00", close: "21:00", source: "default" },
    { date: "2026-10-11", open: "10:00", close: "21:00", source: "default" },
  ],
  contact: {
    email: "events@muktangan.us",
    phone: "+1 (925) 642-0804 / +1 (510) 358-5858",
  },
  notices: [
    "Schedule, food menu and vendors 'coming soon' per organizer site.",
    "Food festival with numerous cultural programs: songs, dance, drama, fashion show, dandiya night.",
  ],
  links: {
    website: "https://muktangan.us/durga-puja-2025/",
    facebook: "https://www.facebook.com/muktangan.us",
  },
});

// ---- Prothoma (Campbell Heritage Center; Ash King, Abhog, Dandiya, fashion show) ----
patch("prothoma", {
  venue: {
    name: "Campbell Heritage Center",
    address: null,
    city: "Campbell",
    lat: 37.2889943,
    lng: -121.951981,
    coordsApprox: true,
  },
  culturalPrograms: [
    {
      title: "Laser Disco Dandiya Night",
      date: "2026-10-09",
      time: null,
      artist: null,
      description: "Electrifying laser disco dandiya kickoff.",
      ticketUrl: "https://www.tugoz.com/events/prothoma/Prothoma-2026-LaserDiscoDandiya",
      free: false,
    },
    {
      title: "Ash King Live in Concert",
      date: "2026-10-10",
      time: "21:00",
      artist: "Ash King",
      description: "Popular Bollywood playback singer live. Ticket info coming soon.",
      free: false,
    },
    {
      title: "Abhog — a play by Suman Mukhopadhyay",
      date: "2026-10-11",
      time: "15:30",
      artist: "Suman Mukhopadhyay, Sudipta Majumdar",
      description: "Premiere of Abhog with meet-and-greet with the director. Ticket info coming soon.",
      free: false,
    },
    {
      title: "Chakra — Circle of Life fashion show",
      date: null,
      time: null,
      artist: null,
      description: "Spectacular fashion show. Absolutely FREE for all.",
      free: true,
    },
    {
      title: "Durnibar Saha live",
      date: null,
      time: null,
      artist: "Durnibar Saha",
      description: "Live performance by the immensely popular Bengali singer. Members get free premium seating.",
      free: null,
    },
  ],
  entry: {
    free: null,
    ticketUrl: null,
    notes: "Dandiya tickets on tugoz; Ash King & Abhog ticket info coming soon. Members get free premium seating for live shows.",
  },
  contact: {},
  links: {
    website: "https://www.prothoma.org/",
    facebook: "https://www.facebook.com/prothoma.norcalba/",
    tickets: "https://www.tugoz.com/events/prothoma/Prothoma-2026-LaserDiscoDandiya",
  },
  notices: ["Venue confirmed as Campbell Heritage Center (per Prothoma site) — earlier sources listed Campbell Community Center / HUSD Hayward."],
  highlights: ["Ash King live Oct 10", "Abhog play by Suman Mukhopadhyay", "Laser Disco Dandiya", "Chakra fashion show (free)"],
});

// ---- Aantorik (full detail: hours, 5 cultural events, contacts) ----
patch("aantorik", {
  weekend: 2,
  dates: [
    { date: "2026-10-16" },
    { date: "2026-10-17" },
    { date: "2026-10-18" },
  ],
  dateLabel: "Oct 16–18, 2026",
  venue: {
    name: "Masonic Center",
    address: "1000 Duchow Way",
    city: "Folsom",
    lat: 38.6779591,
    lng: -121.176058,
    coordsApprox: false,
  },
  hours: [
    { date: "2026-10-16", open: "18:00", close: "22:00", source: "organizer" },
    { date: "2026-10-17", open: "10:00", close: "22:00", source: "organizer" },
    { date: "2026-10-18", open: "10:00", close: "18:00", source: "organizer" },
  ],
  culturalPrograms: [
    {
      title: "Lazy Lamhe — dance program",
      date: "2026-10-16",
      time: "19:00",
      artist: "Aantorik teens & adults, dir. Sujana Ghosal",
      description: null,
    },
    {
      title: "Saptak Bhattacharjee — live musical evening",
      date: "2026-10-16",
      time: "21:00",
      artist: "Saptak Bhattacharjee",
      description: "Playback singer and versatile live performer.",
    },
    {
      title: "Megher Deshe Swapner Kheya — kids program",
      date: "2026-10-17",
      time: "19:00",
      artist: "Aantorik Kids, dir. Pubasha Das",
      description: "Bengali poems and dances.",
    },
    {
      title: "Bhushundir Maathe (ভূশণ্ডির মাঠে) — audio drama",
      date: "2026-10-17",
      time: null,
      artist: null,
      description: "Parashuram's celebrated supernatural satire.",
    },
    {
      title: "Bollywood Bling — dance program",
      date: "2026-10-17",
      time: "19:30",
      artist: "Aantorik teens & adults, dir. Sujana Ghosal",
      description: null,
    },
    {
      title: "Shalini Mukherjee — soulful live in concert",
      date: "2026-10-18",
      time: "16:30",
      artist: "Shalini Mukherjee",
      description: "Devotional and contemporary sounds.",
    },
  ],
  bhog: {
    available: true,
    price: null,
    details: "Traditional Bengali cuisine served during bhog and festive meals.",
  },
  entry: { free: null, ticketUrl: null, notes: "Everyone is welcome — bring family and friends." },
  contact: {
    email: "aantorik.org@gmail.com",
    phone: "+1 (321) 226-8674",
  },
  links: {
    website: "https://aantorik.org/durgapuja-2026",
    facebook: "https://www.facebook.com/people/Aantorik-Sacramento/pfbid02SNL8KefAQS5kYyxv7TS4mbSVyTWHo9BZQtBcU4JpMPyMjFNX84mFcsAWDfujRqo8l/",
  },
  highlights: ["Saptak Bhattacharjee live Oct 16", "Shalini Mukherjee live Oct 18", "Bhushundir Maathe drama", "Sindoor Khela"],
  notices: [],
  status: "verified",
});

// ---- Sanskriti (already rich; add contact + notice) ----
patch("sanskriti", {
  contact: { email: "contact@sanskriti.org" },
  notices: ["Online bhog sales have closed — bhog available for purchase at the venue, till it lasts."],
});

// ---- Pashchimi (add contact) ----
patch("pashchimi", {
  contact: { email: "contact@pashchimi.org" },
});

// ---- Utsav (contacts + programs already known; formalize) ----
patch("utsab", {
  culturalPrograms: [
    {
      title: "Chandrabindoo — opening night",
      date: "2026-10-23",
      time: "21:00",
      artist: "Chandrabindoo",
      description: "Bangla band opens the Silver Jubilee celebrations.",
      ticketUrl: "https://www.eventbrite.com/e/mega-25th-anniversary-opening-with-chandrabindoo-tickets-1993505136527",
      free: false,
    },
    {
      title: "Mahalaxmi Iyer Nite",
      date: "2026-10-25",
      time: "19:00",
      artist: "Mahalaxmi Iyer",
      description: "Closing evening concert.",
      ticketUrl: "https://www.eventbrite.com/e/mahalaxmi-iyer-nite-tickets-1993504121491",
      free: false,
    },
  ],
  contact: { email: "utsavpr@gmail.com" },
  hours: [
    { date: "2026-10-23", open: "18:00", close: "23:00", source: "default" },
    { date: "2026-10-24", open: "10:00", close: "21:00", source: "default" },
    { date: "2026-10-25", open: "10:00", close: "21:00", source: "default" },
  ],
});

// ---- Prabasi (tickets via tugoz; FB musical production notice) ----
patch("prabasi", {
  entry: {
    free: null,
    ticketUrl: "https://www.tugoz.com/events/prabasi",
    notes: "Booths and any ticketed shows via tugoz; check prabasi.org and the Facebook event for the ritual schedule.",
  },
  contact: {},
  notices: ["Prabasi is producing a special musical production for Durga Puja 2026 — vocalists and instrumentalists invited to participate (see Facebook)."],
});

// ---- Agomoni (10th anniversary, open-air, contacts) ----
patch("agomoni", {
  contact: {},
  hours: [
    { date: "2026-10-16", open: "18:00", close: "22:00", source: "default" },
    { date: "2026-10-17", open: "10:00", close: "22:00", source: "default" },
    { date: "2026-10-18", open: "10:00", close: "21:00", source: "default" },
  ],
  notices: [],
});

// ---- BAPuja (2025 pattern Fri 4–9, Sat 9–10, Sun 9–12; 2026 TBA) ----
patch("bapuja", {
  contact: { email: "webmaster@bapuja.org" },
  notices: ["2026 dates not yet announced. 2025 pattern: Fri 4–9pm, Sat 9am–10pm, Sun 9am–12am at Sunnyvale Hindu Temple."],
});

// ---- Shirdi Sai (temple hours daily; Durga Puja program TBA) ----
patch("shirdisai", {
  contact: {
    email: "ShirdiSaiSevak@yahoo.com",
    phone: "408-482-0089",
    notes: "Text or WhatsApp messages only",
  },
  notices: ["Temple open daily; Thu/Sat/Sun 7am–9pm. Durga Puja sponsorship options appear on the temple's paybee page closer to the festival."],
  links: { website: "https://shirdisaidarbar.org/" },
});

// ---- Bengal Club (ICC venue, FB) ----
patch("bengalclub", {
  venue: {
    name: "India Community Center",
    address: "525 Los Coches St",
    city: "Milpitas",
    lat: 37.4319231,
    lng: -121.8952529,
    coordsApprox: false,
  },
  contact: {},
  links: {
    website: "https://www.bengal-club.com/",
    facebook: "https://www.facebook.com/bengalclubbayarea/",
  },
  notices: ["2026 dates not yet announced on the club site."],
});

// ---- Muktangan venue fix stays Brentwood (site says Brentwood CA 94513) ----

// ---- Livermore (JS-only site; keep TBA but add temple note) ----
patch("livermore", {
  notices: ["Temple site requires JavaScript; check the temple calendar page directly for the puja schedule."],
});

fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log("patched. pujas:", data.pujas.length,
  "| with programs:", data.pujas.filter((p) => p.culturalPrograms?.length).length,
  "| with hours:", data.pujas.filter((p) => p.hours?.length).length,
  "| with contact:", data.pujas.filter((p) => p.contact && Object.keys(p.contact).length).length,
  "| with notices:", data.pujas.filter((p) => p.notices?.length).length);
