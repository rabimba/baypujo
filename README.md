# Bay Area Pujo Parikrama — পুজো পরিক্রমা

**Live site:** <https://rabimba.github.io/baypujo/>

All 31 San Francisco Bay Area Durga Puja celebrations (2026) in one place:
schedules, venues, bhog, tickets, and a day-planner to hop multiple pujos.

## Features

- **Directory** (`/pujas/`) — filter by date, region, event type (rituals /
  cultural / food), entry cost, and distance from your location; Leaflet +
  OpenStreetMap view.
- **Pujo detail pages** (`/pujas/[slug]/`) — full ritual schedules where
  published (Sanskriti, Pashchimi, Utsav artist nights), bhog purchase info,
  entry/ticket links, venue map + directions.
- **Parikroma planner** (`/parikroma/`) — pick a date, your free hours, a
  starting point (geolocation or address), and optional must-visit pujas; a
  greedy scheduler builds a feasible hop itinerary with drive-time estimates
  and a numbered route map.
- **Status badges** — "Schedule published" / "Details partial" / "Dates TBA"
  so it's clear what's confirmed vs. to-verify-with-organizer.

## Data

`data/pujas.json` is the single source of truth — 31 pujas, 6 regions, 3
weekends (Oct 9–11, 16–18, 23–25 2026) + TBA listings. Sources: Abahan Bay
Area directory, organizer websites, Drik Panchang (tithi dates). Venue
coordinates from OpenStreetMap Nominatim (approximate pins are flagged).

To update: edit `data/pujas.json`, run `npm run build`.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # planner unit tests (vitest)
npm run typecheck
npm run lint
npm run build      # static export to out/
```

Static export (`output: 'export'`) — deploy `out/` to any static host
(Vercel, Netlify, GitHub Pages, S3).

## Deploy

### GitHub Pages (automated)

1. Push this repo to GitHub (branch `main`).
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Push — `.github/workflows/deploy.yml` builds with
   `PB_BASE_PATH=/<repo-name>` and deploys `out/` (with `.nojekyll`).

This repo deploys to <https://rabimba.github.io/baypujo/>. For a different
repo, the site serves at `https://<owner>.github.io/<repo-name>/`.

### Analytics (optional, privacy-friendly)

No analytics render unless an ID is configured at build time. Both can run
together:

- **GA4** — create a property (Google Analytics), then set repo variable
  `NEXT_PUBLIC_GA_ID` (Settings → Secrets and variables → Actions →
  Variables) to the measurement ID (`G-…`). The workflow injects it.
- **GoatCounter** (cookieless, GDPR-friendly) — create a free counter, set
  repo variable `NEXT_PUBLIC_GOATCOUNTER_CODE` to your site code.

Pageviews track on load and on every client-side route change.

Local preview of the GitHub Pages build:

```bash
npm run build:ghpages   # builds with basePath /<repo-name>
npm run serve:ghpages
```

### Other hosts

`npm run build` (no `PB_BASE_PATH`) produces a plain static site in `out/`
for Vercel/Netlify/S3 — set `NEXT_PUBLIC_SITE_URL` to your domain for the
sitemap.

## Notes

- Drive times are straight-line distance × road factor, not live traffic.
- Where no schedule is published, the planner assumes 10:00–20:00 hours.
- Schedules change — every page links to the organizer for confirmation.
