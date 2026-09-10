import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PujaMapLazy from "../../../components/PujaMapLazy";
import {
  fmtDateLong,
  fmtTime,
  getPuja,
  mapsUrl,
  meta,
  pujas,
  REGION_BN,
  scheduleDates,
  scheduleOn,
  tithiBn,
  eventBn,
} from "../../../lib/pujas";
import { BhogBadge, EntryBadge, StatusBadge } from "../../../components/PujaCard";

export function generateStaticParams() {
  return pujas.map((p) => ({ slug: p.id }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const puja = getPuja(slug);
  if (!puja) return { title: "Puja not found" };
  return {
    title: `${puja.name} 2026 — schedule, bhog & directions`,
    description: `${puja.name} at ${puja.venue.name}, ${puja.venue.city}. ${puja.dateLabel}. Schedule, bhog details, entry, and directions.`,
  };
}

const TYPE_STYLES: Record<string, string> = {
  ritual: "bg-sindoor/10 text-sindoor-dark",
  cultural: "bg-dhunuchi/15 text-dhunuchi",
  food: "bg-emerald-100 text-emerald-800",
};

export default async function PujaDetailPage({ params }: Props) {
  const { slug } = await params;
  const puja = getPuja(slug);
  if (!puja) notFound();

  const days = scheduleDates(puja);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/pujas/"
        className="text-sm font-body font-semibold text-sindoor hover:underline"
      >
        ← All pujas
      </Link>

      <header className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 font-body">
          <span className="font-display normal-case tracking-normal text-sm text-dhunuchi">
            {REGION_BN[puja.region]}
          </span>{" "}
          · {puja.region} · {puja.organizer}
        </p>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-1">
          {puja.name}
        </h1>
        <p className="font-display text-lg text-sindoor mt-1">
          {puja.dateLabel}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <StatusBadge status={puja.status} />
          <EntryBadge puja={puja} />
          <BhogBadge puja={puja} />
          {puja.highlights.map((h) => (
            <span
              key={h}
              className="text-[10px] font-semibold uppercase tracking-wide bg-kash text-dhunuchi rounded-full px-2 py-0.5"
            >
              {h}
            </span>
          ))}
        </div>
      </header>

      <p className="font-body text-stone-700 mt-4">{puja.description}</p>

      <div className="grid gap-4 sm:grid-cols-2 mt-6 font-body">
        {/* Venue card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <h2 className="font-display font-bold text-lg">
            <span className="text-dhunuchi text-sm block leading-none mb-0.5">
              ঠিকানা
            </span>
            Venue
          </h2>
          <p className="text-sm mt-1 text-stone-700">
            {puja.venue.name}
            {puja.venue.address && (
              <>
                <br />
                {puja.venue.address}, {puja.venue.city}, CA
              </>
            )}
          </p>
          {puja.venue.coordsApprox && (
            <p className="text-xs text-amber-700 mt-1">
              Pin approximate — confirm exact venue with organizer.
            </p>
          )}
          <div className="mt-3 flex gap-2 text-sm font-semibold">
            <a
              href={mapsUrl(puja)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sindoor hover:underline"
            >
              Google Maps ↗
            </a>
            <a
              href={`https://maps.apple.com/?q=${encodeURIComponent(
                `${puja.venue.name} ${puja.venue.city} CA`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sindoor hover:underline"
            >
              Apple Maps ↗
            </a>
          </div>
          <div className="mt-3">
            <PujaMapLazy
              pujas={[puja]}
              center={[puja.venue.lat, puja.venue.lng]}
              zoom={13}
              className="h-56 w-full rounded-xl border border-stone-200"
            />
          </div>
        </div>

        {/* Practical info card */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="font-display font-bold text-lg">
              <span className="text-dhunuchi text-sm block leading-none mb-0.5">
                ভোগ
              </span>
              Bhog
            </h2>
            {puja.bhog.available === null ? (
              <p className="text-sm text-stone-600 mt-1">
                Bhog info not yet published — check with the organizer.
              </p>
            ) : (
              <>
                <p className="text-sm text-stone-700 mt-1">
                  {puja.bhog.details ?? "Bhog served during the puja."}
                </p>
                {puja.bhog.price && (
                  <p className="text-sm font-semibold mt-1">
                    Price: {puja.bhog.price}
                  </p>
                )}
                {puja.bhog.purchaseUrl && (
                  <a
                    href={puja.bhog.purchaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm font-semibold text-sindoor hover:underline"
                  >
                    Buy bhog / package ↗
                  </a>
                )}
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="font-display font-bold text-lg">
              <span className="text-dhunuchi text-sm block leading-none mb-0.5">
                প্রবেশ ও টিকিট
              </span>
              Entry & tickets
            </h2>
            <p className="text-sm text-stone-700 mt-1">
              {puja.entry.free === true
                ? "Free entry."
                : puja.entry.free === false
                  ? "Ticketed event."
                  : "Entry details not yet published."}{" "}
              {puja.entry.notes ?? ""}
            </p>
            {puja.links.tickets && (
              <a
                href={puja.links.tickets}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-sm font-semibold text-sindoor hover:underline"
              >
                Get tickets ↗
              </a>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="font-display font-bold text-lg">
              <span className="text-dhunuchi text-sm block leading-none mb-0.5">
                যোগাযোগ
              </span>
              Contact & links
            </h2>
            <div className="flex flex-col gap-1 mt-1 text-sm font-semibold">
              {puja.contact.email && (
                <a
                  href={`mailto:${puja.contact.email}`}
                  className="text-sindoor hover:underline"
                >
                  ✉ {puja.contact.email}
                </a>
              )}
              {puja.contact.phone && (
                <a
                  href={`tel:${puja.contact.phone.replace(/[^+\d]/g, "")}`}
                  className="text-sindoor hover:underline"
                >
                  ☎ {puja.contact.phone}
                </a>
              )}
              {puja.contact.notes && (
                <p className="text-xs text-stone-500 font-normal">
                  {puja.contact.notes}
                </p>
              )}
              {puja.links.website && (
                <a
                  href={puja.links.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sindoor hover:underline"
                >
                  Official website ↗
                </a>
              )}
              {puja.links.facebook && (
                <a
                  href={puja.links.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sindoor hover:underline"
                >
                  Facebook page ↗
                </a>
              )}
              {!puja.links.website && !puja.links.facebook && !puja.contact.email && !puja.contact.phone && (
                <p className="text-stone-600 font-normal">
                  No public organizer contact yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cultural programs */}
      {puja.culturalPrograms.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display font-bold text-2xl">
            <span className="text-dhunuchi text-base block leading-none mb-0.5">
              সাংস্কৃতিক অনুষ্ঠান
            </span>
            Cultural programs
          </h2>
          <div className="mt-3 space-y-2 font-body">
            {puja.culturalPrograms
              .slice()
              .sort((a, b) => `${a.date ?? ""}${a.time ?? ""}`.localeCompare(`${b.date ?? ""}${b.time ?? ""}`))
              .map((c, i) => (
                <div
                  key={i}
                  className="bg-white border border-stone-200 rounded-2xl p-4"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-display font-bold text-sindoor-dark">
                      {c.title}
                    </h3>
                    {c.artist && (
                      <span className="text-sm text-stone-600">— {c.artist}</span>
                    )}
                    <span className="ml-auto text-xs text-stone-500">
                      {c.date ? fmtDateLong(c.date) : "Date TBA"}
                      {c.time ? ` · ${c.time}` : ""}
                    </span>
                  </div>
                  {c.description && (
                    <p className="text-sm text-stone-600 mt-1">{c.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    {c.free === true && (
                      <span className="font-semibold text-emerald-700">
                        FREE
                      </span>
                    )}
                    {c.free === false && (
                      <span className="font-semibold text-rose-700">
                        Ticketed
                      </span>
                    )}
                    {c.ticketUrl && (
                      <a
                        href={c.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sindoor hover:underline"
                      >
                        Get tickets ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Notices */}
      {puja.notices.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display font-bold text-2xl">
            <span className="text-dhunuchi text-base block leading-none mb-0.5">
              ঘোষণা
            </span>
            Notices
          </h2>
          <ul className="mt-3 space-y-2 font-body text-sm">
            {puja.notices.map((n, i) => (
              <li
                key={i}
                className="bg-kash/60 border border-dhunuchi/30 rounded-2xl px-4 py-3 text-ink/90 flex gap-2"
              >
                <span aria-hidden className="diya inline-block w-2 h-2 rounded-full bg-sindoor mt-1.5 shrink-0" />
                {n}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Schedule */}
      <section className="mt-8">
        <h2 className="font-display font-bold text-2xl">
          <span className="text-dhunuchi text-base block leading-none mb-0.5">
            পূজার সময়সূচি
          </span>
          Schedule{" "}
          {puja.schedule.length > 0 && (
            <span className="text-sm font-body font-normal text-stone-500">
              ({puja.schedule.length} events)
            </span>
          )}
        </h2>
        {days.length === 0 && (puja.hours ?? []).length > 0 && (
          <div className="space-y-1.5 mt-3 font-body">
            {(puja.hours ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
              <div
                key={h.date}
                className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 flex flex-wrap items-baseline gap-x-4 text-sm"
              >
                <span className="font-display font-semibold text-sindoor-dark">
                  {tithiBn(h.date) ? `${tithiBn(h.date)} · ` : ""}
                  {fmtDateLong(h.date)}
                </span>
                <span className="font-mono text-xs text-stone-500">
                  {fmtTime(h.open)} – {fmtTime(h.close)}
                </span>
                {h.source === "organizer" ? (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-800 rounded-full px-2 py-0.5">
                    Organizer hours
                  </span>
                ) : (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide bg-stone-100 text-stone-500 rounded-full px-2 py-0.5">
                    Estimated
                  </span>
                )}
              </div>
            ))}
            <p className="text-xs text-stone-500 px-1">
              Detailed ritual schedule not yet published — timings above are
              opening hours. Verify with the organizer.
            </p>
          </div>
        )}
        {days.length === 0 && (puja.hours ?? []).length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mt-3 font-body text-sm text-amber-900">
            Detailed schedule not yet published for {puja.dateLabel}. Check the
            organizer links above close to the puja dates.
            {puja.status !== "verified" && (
              <>
                {" "}
                Most pujas run roughly 10am–9pm on weekend days, with
                pushpanjali late morning and sandhya arati in the evening.
              </>
            )}
          </div>
        )}
        {days.length > 0 && (
          <div className="space-y-6 mt-3">
            {days.map((d) => (
              <div key={d}>
                <h3 className="font-display font-semibold text-lg text-sindoor-dark">
                  {tithiBn(d) && (
                    <span className="text-sindoor mr-2">{tithiBn(d)}</span>
                  )}
                  {fmtDateLong(d)}
                </h3>
                <ul className="mt-2 space-y-1.5 font-body">
                  {scheduleOn(puja, d).map((e, i) => (
                    <li
                      key={i}
                      className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1"
                    >
                      <span className="font-mono text-xs text-stone-500 w-28 shrink-0">
                        {fmtTime(e.start)}
                        {e.end ? ` – ${fmtTime(e.end)}` : ""}
                      </span>
                      <span className="font-medium text-sm">
                        {e.title}
                        {eventBn(e.title) && (
                          <span className="font-display text-dhunuchi ml-2">
                            {eventBn(e.title)}
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ml-auto ${TYPE_STYLES[e.type] ?? ""}`}
                      >
                        {e.type}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {puja.status !== "verified" && (
        <p className="mt-8 text-xs text-stone-500 font-body bg-stone-100 rounded-xl p-4">
          Details last checked {meta.lastVerified}. Schedules change — please
          confirm with the organizer before traveling.
        </p>
      )}
    </div>
  );
}
