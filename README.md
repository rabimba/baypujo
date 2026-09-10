# Houston Pujo Parikrama — পুজো পরিক্রমা

**Live site:** <https://rabimba.github.io/houstonpujo/>

Every Bengali Durga Puja in greater Houston (2026) in one place: schedules,
venues, bhog, tickets, and a day-planner to hop multiple pujos. Houston's
major pujas (HDBS, SDKKM) follow the true tithi calendar — Bodhan Oct 15
through Dashami Oct 20 — rather than the weekend model.

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

City-scoped data lives in `data/cities/<city>/`:

- `pujas.json` — the pujas, schedule, venue, bhog, entry, programs (the
  single source of truth for that city)
- `city.json` — brand strings, regions + colors + Bengali names, map
  center, weekend labels, festival dates, drive-time params, verify-script
  samples, planner examples

`site.config.json` at the repo root selects the city this repo builds
(`{ "city": "houston" }`) — **the only intentional difference between
city repos**. `PB_CITY` env overrides for local dev (e.g.
`PB_CITY=bayarea npm run build`).

To update: edit `data/cities/<city>/pujas.json`, run `npm run build`.

### Multi-city model

One codebase, one repo per city. Each repo's `main` builds its own city.
Sync code fixes between them:

```bash
# in houstonpujo clone (baypujo added as remote "baypujo")
git fetch baypujo && git merge baypujo/main
# resolve site.config.json to keep "houston", push
```

Adding a new city: `data/cities/<newcity>/{city,pujas}.json`, flip
`site.config.json`, run the verify battery with `PB_BASE_PATH=/<repo>`.

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

This repo deploys to <https://rabimba.github.io/houstonpujo/>. For a different
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
