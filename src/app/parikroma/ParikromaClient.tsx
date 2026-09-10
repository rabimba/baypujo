"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PujaMapLazy from "../../components/PujaMapLazy";
import ShareBar from "../../components/ShareBar";
import {
  ALL_FESTIVAL_DATES,
  city,
  fmtDate,
  fmtDateLong,
  pujas,
  tithiBn,
  WEEKEND_LABELS,
} from "../../lib/pujas";
import { planParikroma, minToHm, hmToMin } from "../../lib/planner";
import { parseShareQuery } from "../../lib/share";
import type { LatLng } from "../../lib/types";

export default function ParikromaClient() {
  // Prefill from a shared plan link (?date=&start=&end=&dwell=&must=&lat=&lng=)
  const prefill = useMemo(() => {
    if (typeof window === "undefined") return null;
    return parseShareQuery(new URLSearchParams(window.location.search));
  }, []);

  const [date, setDate] = useState(prefill?.date ?? "2026-10-17");
  const [startTime, setStartTime] = useState(prefill?.start ?? "10:00");
  const [endTime, setEndTime] = useState(prefill?.end ?? "20:00");
  const [dwell, setDwell] = useState(prefill?.dwell ?? 60);
  const [mustVisit, setMustVisit] = useState<string[]>(prefill?.must ?? []);
  const [originMode, setOriginMode] = useState<"geo" | "address">(
    prefill ? "address" : "geo",
  );
  const [address, setAddress] = useState(prefill?.label ?? "");
  const [origin, setOrigin] = useState<LatLng | null>(
    prefill?.lat != null && prefill?.lng != null
      ? { lat: prefill.lat, lng: prefill.lng }
      : null,
  );
  const [geoStatus, setGeoStatus] = useState("");
  const [addrStatus, setAddrStatus] = useState(
    prefill ? "Loaded from shared plan link" : "",
  );

  const active = useMemo(
    () => pujas.filter((p) => p.dates.some((d) => d.date === date)),
    [date],
  );

  const useGeo = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation not supported — use address instead");
      return;
    }
    setGeoStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // Reject null-island / clearly non-metro fixes silently returned by
        // some IP-based providers (0,0 or thousands of miles off).
        const inMetro =
          Math.abs(lat - city.center.lat) < 1.5 &&
          Math.abs(lng - city.center.lng) < 2.5;
        if (lat === 0 && lng === 0) {
          setOrigin(null);
          setGeoStatus("Got an empty location fix — enter your address below instead");
          return;
        }
        setOrigin({ lat, lng });
        setGeoStatus(
          inMetro
            ? ""
            : `Got (${lat.toFixed(3)}, ${lng.toFixed(3)}) — that's outside the ${city.cityLabelShort}. If this is wrong, enter your address below.`,
        );
      },
      () => setGeoStatus("Could not get location — try entering an address"),
    );
  };

  const geocodeAddress = async () => {
    const q = address.trim();
    if (!q) {
      setAddrStatus("Enter an address first");
      return;
    }
    setAddrStatus("Looking up…");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          q,
        )}&format=json&limit=1&addressdetails=1&countrycodes=us`,
        { headers: { "Accept-Language": "en" } },
      );
      const j = await res.json();
      if (j[0]) {
        const label = (j[0].display_name ?? "").split(",").slice(0, 3).join(",");
        const farFromMetro =
          j[0].lat &&
          (Math.abs(+j[0].lat - city.center.lat) > 1.5 ||
            Math.abs(+j[0].lon - city.center.lng) > 2.5);
        if (farFromMetro) {
          // rough metro sanity check
          setAddrStatus(
            `Found ${label} — that looks far from the ${city.cityLabelShort}. Double-check the address.`,
          );
        }
        setOrigin({ lat: +j[0].lat, lng: +j[0].lon });
        setAddrStatus(`Found: ${label}`);
      } else {
        setAddrStatus(
          `No match — try a full street address with city, or a city name like "${city.plannerCityQuery}"`,
        );
      }
    } catch {
      setAddrStatus("Lookup failed — check connection");
    }
  };

  // Live plan: recomputes as soon as a start point exists, and on every
  // input change (date, hours, dwell, must-visits).
  const result = useMemo(() => {
    if (!origin) return null;
    return planParikroma({
      date,
      startTime,
      endTime,
      origin,
      dwellMin: dwell,
      mustVisit,
      candidates: active,
    });
  }, [origin, date, startTime, endTime, dwell, mustVisit, active]);

  const toggleMust = (id: string) =>
    setMustVisit((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const route = result
    ? [
        { lat: origin!.lat, lng: origin!.lng, label: "Start", color: "#2b1d16" },
        ...result.stops.map((s) => ({
          lat: s.puja.venue.lat,
          lng: s.puja.venue.lng,
          label: s.puja.name,
        })),
      ]
    : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display font-extrabold text-3xl sm:text-4xl">
        <span className="block text-dhunuchi text-lg leading-none mb-1">
          একদিনে কয়েকটি পুজো ঘুরে আসুন
        </span>
        Plan your pujo parikroma
      </h1>
      <p className="font-body text-stone-600 text-sm mt-1 max-w-2xl">
        Pick a day and your free hours — we&apos;ll map out which pujas to
        visit, in what order, with realistic drive times between venues.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] mt-6">
        {/* Form */}
        <div className="space-y-5 font-body print-hide">
          <section className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="font-display font-bold text-lg">Your day</h2>
            <div className="grid gap-3 sm:grid-cols-3 mt-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="font-medium text-stone-700">Date</span>
                <select
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setMustVisit([]);
                  }}
                  className="rounded-xl border border-stone-300 px-3 py-2 bg-white focus:border-sindoor focus:outline-none"
                >
                  {ALL_FESTIVAL_DATES.map((d) => (
                    <option key={d} value={d}>
                      {tithiBn(d) ? `${tithiBn(d)} · ` : ""}
                      {fmtDate(d)} ({pujas.filter((p) => p.dates.some((x) => x.date === d)).length} pujas)
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium text-stone-700">Free from</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-xl border border-stone-300 px-3 py-2 bg-white focus:border-sindoor focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium text-stone-700">Free until</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-xl border border-stone-300 px-3 py-2 bg-white focus:border-sindoor focus:outline-none"
                />
              </label>
            </div>
            <label className="flex items-center gap-3 mt-4 text-sm">
              <span className="font-medium text-stone-700">
                Time at each pujo: {dwell} min
              </span>
              <input
                type="range"
                min={30}
                max={180}
                step={15}
                value={dwell}
                onChange={(e) => setDwell(Number(e.target.value))}
                className="accent-sindoor flex-1"
              />
            </label>
          </section>

          <section className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="font-display font-bold text-lg">Starting point</h2>
            <div className="flex gap-2 mt-3 text-sm">
              <button
                onClick={() => setOriginMode("geo")}
                className={`rounded-full px-4 py-1.5 font-semibold transition-colors ${originMode === "geo" ? "bg-sindoor text-white" : "bg-stone-100 text-stone-600"}`}
              >
                My location
              </button>
              <button
                onClick={() => setOriginMode("address")}
                className={`rounded-full px-4 py-1.5 font-semibold transition-colors ${originMode === "address" ? "bg-sindoor text-white" : "bg-stone-100 text-stone-600"}`}
              >
                Address
              </button>
            </div>
            {originMode === "geo" ? (
              <div className="mt-3">
                <button
                  onClick={useGeo}
                  className="rounded-xl bg-sindoor text-white px-4 py-2 text-sm font-semibold hover:bg-sindoor-dark transition-colors"
                >
                  Use my current location
                </button>
                <p className="text-xs text-stone-500 mt-1">{geoStatus}</p>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={city.plannerAddressExample}
                  className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm bg-white focus:border-sindoor focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && geocodeAddress()}
                />
                <button
                  onClick={geocodeAddress}
                  className="rounded-xl bg-sindoor text-white px-4 py-2 text-sm font-semibold hover:bg-sindoor-dark transition-colors"
                >
                  Find
                </button>
              </div>
            )}
            {addrStatus && (
              <p className="text-xs text-stone-500 mt-1">{addrStatus}</p>
            )}
            {origin && (
              <p className="text-xs text-emerald-700 mt-2 font-semibold">
                ✓ Start point set ({origin.lat.toFixed(3)}, {origin.lng.toFixed(3)})
              </p>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="font-display font-bold text-lg">
              Must-visit pujas{" "}
              <span className="text-sm font-body font-normal text-stone-500">
                (optional)
              </span>
            </h2>
            <p className="text-xs text-stone-500 mt-1 font-body">
              Active on {fmtDateLong(date)} ·{" "}
              {WEEKEND_LABELS[
                String(active[0]?.weekend ?? "")
              ] ?? "various weekends"}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {active.map((p) => {
                const on = mustVisit.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleMust(p.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                      on
                        ? "bg-sindoor text-white border-sindoor"
                        : "bg-white text-stone-600 border-stone-300 hover:border-sindoor"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
              {active.length === 0 && (
                <p className="text-sm text-stone-500">
                  No pujas on this date yet.
                </p>
              )}
            </div>
          </section>

          <div
            className={`rounded-2xl px-5 py-4 font-body text-sm font-semibold text-center transition-colors ${
              origin
                ? "bg-green-50 text-emerald-800 border border-emerald-200"
                : "bg-kash/70 text-dhunuchi border border-dhunuchi/30"
            }`}
            aria-live="polite"
          >
            {origin
              ? `✓ Itinerary updates live — ${result?.stops.length ?? 0} stop${(result?.stops.length ?? 0) === 1 ? "" : "s"} planned`
              : "Set a starting point to see your itinerary"}
          </div>
        </div>

        {/* Result panel */}
        <div className="space-y-4">
          {!origin || !result ? (
            <div className="bg-stone-100 rounded-2xl p-6 text-sm text-stone-500 font-body h-full flex items-center justify-center text-center">
              Your itinerary appears here — set your day and starting point,
              then build.
            </div>
          ) : (
            <>
              {result.diagnostics.originTooFar && (
                <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 font-body text-sm text-rose-900">
                  <p className="font-bold font-display text-base">
                    Your start point looks wrong
                  </p>
                  <p className="mt-1">
                    It&apos;s {Math.round(result.diagnostics.nearestPujaMi ?? 0)} miles
                    to the nearest puja — that&apos;s outside the metro, so
                    nothing fits your day. Your browser&apos;s location (or the
                    address found) is probably off.{" "}
                    <strong>
                      Switch to Address above and enter e.g. &quot;
                      {city.plannerCityQuery}&quot;
                    </strong>{" "}
                    — or your actual street address.
                  </p>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 font-body">
                {/* print-only brand header — the only visible brand on PDF */}
                <div className="print-brand border-b-2 border-sindoor pb-2 mb-3">
                  <p className="font-display font-bold text-xl text-sindoor">
                    ${city.brandBn} · {city.brand}
                  </p>
                  <p className="text-xs text-stone-500">
                    Durga Puja 2026 guide — planned on{" "}
                    {typeof window !== "undefined"
                      ? window.location.host +
                        window.location.pathname.replace(/\/parikroma\/.*$/, "")
                      : "this site"}
                  </p>
                </div>
                <h2 className="font-display font-bold text-lg">
                  <span className="text-dhunuchi text-sm block leading-none mb-0.5">
                    আপনার পরিক্রমা
                  </span>
                  Your {fmtDateLong(date)} parikroma
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {result.stops.length} pujas · {Math.round(result.totalDriveMi)} mi total driving ·{" "}
                  {Math.round(result.totalDriveMin / 60)}h{result.totalDriveMin % 60 ? ` ${result.totalDriveMin % 60}m` : ""} on the road
                  {result.diagnostics.nearestPujaMi !== null && (
                    <span className="text-stone-400">
                      {" "}· nearest puja {Math.round(result.diagnostics.nearestPujaMi)} mi from start
                    </span>
                  )}
                </p>
                <ol className="mt-4 space-y-0">
                  {result.stops.map((s, i) => (
                    <li key={s.puja.id} className="relative pl-9 pb-5 rise-in" style={{ animationDelay: `${i * 60}ms` }}>
                      {i < result.stops.length - 1 && (
                        <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-0.5 bg-stone-200" />
                      )}
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 w-7 h-7 rounded-full bg-sindoor text-white grid place-items-center text-xs font-bold"
                      >
                        {i + 1}
                      </span>
                      {i > 0 && (
                        <p className="text-[11px] text-stone-400 mb-0.5">
                          ↳ {minToHm(s.arrive)} arrive · ~{s.driveFromPrevMin} min drive
                        </p>
                      )}
                      <Link
                        href={`/pujas/${s.puja.id}/`}
                        className="font-display font-bold text-sindoor-dark hover:text-sindoor"
                      >
                        {s.puja.name}
                      </Link>
                      {s.isMustVisit && (
                        <span className="ml-2 text-[10px] uppercase font-bold text-dhunuchi">
                          must
                        </span>
                      )}
                      <p className="text-xs text-stone-600">
                        {minToHm(Math.max(s.arrive, hmToMin(startTime)))} –{" "}
                        {minToHm(s.depart)} · {s.puja.venue.city}
                        {s.events.length > 0 && (
                          <>
                            {" "}
                            · ধরুন: {s.events.map((e) => e.title).join(", ").slice(0, 80)}
                            {s.events.map((e) => e.title).join(", ").length > 80 ? "…" : ""}
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ol>
                {result.stops.length === 0 && (
                  <div className="text-sm text-stone-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="font-semibold text-amber-900">
                      No pujas fit this window yet.
                    </p>
                    <p className="mt-1">
                      {active.length === 0
                        ? "No pujas are scheduled on this date — pick another day."
                        : `Your window is ${startTime}–${endTime} with ${dwell} min per puja. Try:`}
                    </p>
                    {active.length > 0 && (
                      <ul className="list-disc pl-5 mt-1 space-y-0.5">
                        <li>Start earlier (9:00) or stay later (21:00)</li>
                        <li>Shorten dwell time to 45 min</li>
                        <li>
                          Check the skipped list below — pujas closing before
                          your start time can&apos;t be reached
                        </li>
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {route && route.length > 1 && (
                <PujaMapLazy
                  pujas={[]}
                  route={route}
                  className="h-72 w-full rounded-2xl border border-stone-200 print:hidden"
                />
              )}

              {result.stops.length > 0 && (
                <ShareBar
                  ctx={{
                    date,
                    startTime,
                    endTime,
                    dwellMin: dwell,
                    result,
                    originLat: origin?.lat,
                    originLng: origin?.lng,
                    originLabel: address.trim()
                      ? address.trim()
                      : origin
                        ? "my location"
                        : undefined,
                  }}
                  siteUrl={
                    typeof window !== "undefined"
                      ? // origin + basePath (works on GitHub Pages subpaths)
                        window.location.origin +
                        window.location.pathname.replace(/\/parikroma\/.*$/, "")
                      : ""
                  }
                />
              )}

              {result.skipped.length > 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 p-5 font-body print:hidden">
                  <h3 className="font-display font-bold text-sm text-stone-600">
                    Skipped ({result.skipped.length})
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {result.skipped.map((s) => (
                      <li key={s.puja.id} className="text-xs text-stone-500">
                        <Link
                          href={`/pujas/${s.puja.id}/`}
                          className="font-semibold text-stone-700 hover:text-sindoor"
                        >
                          {s.puja.name}
                        </Link>{" "}
                        — {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-stone-400 font-body px-1">
                Drive times are straight-line estimates with a local road
                factor — leave buffer for parking and dhak-induced lingering.
                Where no schedule is published, we assume 10am–8pm.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
