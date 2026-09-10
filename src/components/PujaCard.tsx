import Link from "next/link";
import type { Puja } from "../lib/types";
import { REGION_BN, REGION_COLORS, fmtTime, tithiBn } from "../lib/pujas";
import { haversineMi } from "../lib/geo";
import type { LatLng } from "../lib/types";

export function StatusBadge({ status }: { status: Puja["status"] }) {
  if (status === "verified")
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-800 rounded-full px-2 py-0.5">
        Schedule published
      </span>
    );
  if (status === "tba")
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
        Dates TBA
      </span>
    );
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide bg-stone-200 text-stone-600 rounded-full px-2 py-0.5">
      Details partial
    </span>
  );
}

export function EntryBadge({ puja }: { puja: Puja }) {
  if (puja.entry.free === true)
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5">
        Free entry
      </span>
    );
  if (puja.entry.free === false)
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide bg-rose-100 text-rose-800 rounded-full px-2 py-0.5">
        Ticketed
      </span>
    );
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide bg-stone-100 text-stone-500 rounded-full px-2 py-0.5">
      Entry: check organizer
    </span>
  );
}

export function BhogBadge({ puja }: { puja: Puja }) {
  if (puja.bhog.available === true)
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide bg-orange-100 text-orange-800 rounded-full px-2 py-0.5">
        Bhog available
      </span>
    );
  return null;
}

export default function PujaCard({
  puja,
  userLoc,
}: {
  puja: Puja;
  userLoc: LatLng | null;
}) {
  const dist = userLoc ? haversineMi(userLoc, puja.venue) : null;
  const regionColor = REGION_COLORS[puja.region];
  return (
    <Link
      href={`/pujas/${puja.id}/`}
      className="group block bg-white rounded-2xl border border-stone-200 hover:border-sindoor/40 hover:shadow-lg transition-all p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sindoor"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider flex items-baseline gap-1.5"
            style={{ color: regionColor }}
          >
            <span className="font-display normal-case tracking-normal text-sm leading-none">
              {REGION_BN[puja.region]}
            </span>
            <span className="opacity-70">
              · {puja.region} · {puja.dateLabel}
            </span>
          </p>
          <h3 className="font-display font-bold text-lg leading-tight mt-0.5 group-hover:text-sindoor transition-colors">
            {puja.name}
          </h3>
          <p className="text-sm text-stone-600 mt-1 font-body">
            {puja.venue.name} · {puja.venue.city}
            {puja.dates[0] && tithiBn(puja.dates[0].date) && (
              <span className="text-dhunuchi font-semibold">
                {" "}
                · {puja.dates.map((d) => tithiBn(d.date)).filter(Boolean).join("–")}
              </span>
            )}
          </p>
        </div>
        {dist !== null && (
          <span className="shrink-0 text-xs font-semibold text-stone-500 bg-stone-100 rounded-full px-2.5 py-1 whitespace-nowrap">
            {dist < 10 ? dist.toFixed(1) : Math.round(dist)} mi
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        <StatusBadge status={puja.status} />
        <EntryBadge puja={puja} />
        <BhogBadge puja={puja} />
        {puja.culturalPrograms.length > 0 && (
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-purple-100 text-purple-800 rounded-full px-2 py-0.5">
            {puja.culturalPrograms.length} cultural{" "}
            {puja.culturalPrograms.length === 1 ? "event" : "events"}
          </span>
        )}
        {puja.highlights.slice(0, 1).map((h) => (
          <span
            key={h}
            className="text-[10px] font-semibold uppercase tracking-wide bg-kash text-dhunuchi rounded-full px-2 py-0.5"
          >
            {h}
          </span>
        ))}
      </div>
      {puja.schedule.length > 0 && (
        <p className="text-xs text-stone-500 mt-3 font-body">
          Next ritual: {fmtTime(puja.schedule[0].start)} —{" "}
          {puja.schedule[0].title}
        </p>
      )}
    </Link>
  );
}
