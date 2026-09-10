"use client";

import { useMemo, useState } from "react";
import PujaCard from "../../components/PujaCard";
import PujaMapLazy from "../../components/PujaMapLazy";
import {
  ALL_FESTIVAL_DATES,
  REGIONS,
  REGION_BN,
  fmtDate,
  pujas as allPujas,
  tithiBn,
} from "../../lib/pujas";
import { haversineMi } from "../../lib/geo";
import type { LatLng } from "../../lib/types";

type EventFilter = "all" | "ritual" | "cultural" | "food";

const EVENT_LABELS: Record<EventFilter, string> = {
  all: "All events",
  ritual: "Rituals (pushpanjali, sandhi, arati)",
  cultural: "Cultural (concerts, dhunuchi)",
  food: "Food (bhog, prasad)",
};

export default function DirectoryClient() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("all");
  const [date, setDate] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [entry, setEntry] = useState<string>("all");
  const [showMap, setShowMap] = useState(true);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [locStatus, setLocStatus] = useState<string>("");
  const [radius, setRadius] = useState<number>(25);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus("Geolocation not supported");
      return;
    }
    setLocStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("");
      },
      () => setLocStatus("Location denied — enter address in the planner instead"),
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allPujas
      .filter((p) => {
        if (q) {
          const hay = `${p.name} ${p.organizer} ${p.venue.name} ${p.venue.city} ${p.region}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (region !== "all" && p.region !== region) return false;
        if (date !== "all" && !p.dates.some((d) => d.date === date)) return false;
        if (eventFilter !== "all") {
          const match =
            eventFilter === "food"
              ? p.bhog.available === true || p.schedule.some((e) => e.type === "food")
              : p.schedule.some((e) => e.type === eventFilter);
          if (!match) return false;
        }
        if (entry === "free" && p.entry.free !== true) return false;
        if (entry === "paid" && p.entry.free !== false) return false;
        if (entry === "unknown" && p.entry.free !== null) return false;
        if (userLoc && haversineMi(userLoc, p.venue) > radius) return false;
        return true;
      })
      .sort((a, b) => {
        if (userLoc) {
          return haversineMi(userLoc, a.venue) - haversineMi(userLoc, b.venue);
        }
        return a.name.localeCompare(b.name);
      });
  }, [query, region, date, eventFilter, entry, userLoc, radius]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display font-extrabold text-3xl">
        <span className="block text-dhunuchi text-lg leading-none mb-1">
          সমস্ত পুজো দেখুন
        </span>
        All Bay Area Pujas
      </h1>
      <p className="font-body text-stone-600 text-sm mt-1">
        {filtered.length} of {allPujas.length} pujas
      </p>

      {/* Filters */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-body text-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, organizer, city…"
          className="rounded-xl border border-stone-300 px-3 py-2 bg-white focus:border-sindoor focus:outline-none"
          aria-label="Search pujas"
        />
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-xl border border-stone-300 px-3 py-2 bg-white focus:border-sindoor focus:outline-none"
          aria-label="Filter by region"
        >
          <option value="all">All regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r} · {REGION_BN[r]}
            </option>
          ))}
        </select>
        <select
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-stone-300 px-3 py-2 bg-white focus:border-sindoor focus:outline-none"
          aria-label="Filter by date"
        >
          <option value="all">Any date</option>
          {ALL_FESTIVAL_DATES.map((d) => (
            <option key={d} value={d}>
              {tithiBn(d) ? `${tithiBn(d)} · ` : ""}
              {fmtDate(d)}{" "}
              {`(${allPujas.filter((p) => p.dates.some((x) => x.date === d)).length})`}
            </option>
          ))}
        </select>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value as EventFilter)}
          className="rounded-xl border border-stone-300 px-3 py-2 bg-white focus:border-sindoor focus:outline-none"
          aria-label="Filter by event type"
        >
          {(Object.keys(EVENT_LABELS) as EventFilter[]).map((k) => (
            <option key={k} value={k}>
              {EVENT_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          className="rounded-xl border border-stone-300 px-3 py-2 bg-white focus:border-sindoor focus:outline-none"
          aria-label="Filter by entry"
        >
          <option value="all">Entry: any</option>
          <option value="free">Free entry</option>
          <option value="paid">Ticketed</option>
          <option value="unknown">Entry unknown</option>
        </select>
        <div className="flex gap-2 items-center">
          <button
            onClick={useMyLocation}
            className="rounded-xl bg-sindoor text-white px-4 py-2 font-semibold hover:bg-sindoor-dark transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sindoor"
          >
            Use my location
          </button>
          {userLoc && (
            <label className="flex items-center gap-2 text-xs text-stone-600">
              within
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="accent-sindoor"
              />
              {radius} mi
            </label>
          )}
        </div>
        <button
          onClick={() => setShowMap(!showMap)}
          className="rounded-xl border border-stone-300 px-4 py-2 bg-white hover:border-sindoor transition-colors font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sindoor"
        >
          {showMap ? "Hide map" : "Show map"}
        </button>
        <button
          onClick={() => {
            setQuery("");
            setRegion("all");
            setDate("all");
            setEventFilter("all");
            setEntry("all");
          }}
          className="rounded-xl border border-stone-300 px-4 py-2 bg-white hover:border-sindoor transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sindoor"
        >
          Reset filters
        </button>
      </div>
      {locStatus && (
        <p className="text-xs text-stone-500 mt-2 font-body">{locStatus}</p>
      )}

      {showMap && (
        <div className="mt-6">
          <PujaMapLazy pujas={filtered} className="h-[420px] w-full rounded-2xl border border-stone-200" />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <PujaCard key={p.id} puja={p} userLoc={userLoc} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-stone-500 font-body text-sm mt-8 text-center">
          No pujas match these filters. Try widening the radius or resetting.
        </p>
      )}
    </div>
  );
}
