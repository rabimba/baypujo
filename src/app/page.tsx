import Link from "next/link";
import PujaCard from "../components/PujaCard";
import {
  AlponaDivider,
  DurgaEye,
  KaashPhool,
  Toran,
  Shiuli,
} from "../components/motifs";
import {
  meta,
  pujas,
  REGION_BN,
  tithiBn,
  WEEKEND_LABELS,
  fmtDateLong,
} from "../lib/pujas";

const WEEKEND_BN: Record<string, string> = {
  "1": "প্রথম সপ্তাহান্ত",
  "2": "দ্বিতীয় সপ্তাহান্ত",
  "3": "তৃতীয় সপ্তাহান্ত",
};

export default function HomePage() {
  const w1 = pujas.filter((p) => p.weekend === 1);
  const w2 = pujas.filter((p) => p.weekend === 2);
  const w3 = pujas.filter((p) => p.weekend === 3);
  const other = pujas.filter((p) => p.weekend === 0);
  const tba = pujas.filter((p) => p.weekend === null);
  const withSchedule = pujas.filter((p) => p.schedule.length > 0);
  const withBhog = pujas.filter((p) => p.bhog.available === true);
  const free = pujas.filter((p) => p.entry.free === true);

  return (
    <div>
      {/* Hero */}
      <section className="durgo-gradient text-white relative overflow-hidden">
        <div
          aria-hidden
          className="alpona-border absolute inset-x-4 inset-y-4 rounded-3xl pointer-events-none"
        />
        <KaashPhool
          className="absolute -left-2 sm:left-6 bottom-0 h-40 sm:h-52 text-kash/50 pointer-events-none"
          aria-hidden
        />
        <KaashPhool
          className="absolute -right-2 sm:right-6 bottom-0 h-40 sm:h-52 text-kash/50 pointer-events-none"
          flip
        />
        <div className="relative mx-auto max-w-3xl px-4 pt-16 sm:pt-20 pb-10 text-center">
          <div className="flex items-center justify-center gap-3 text-sona">
            <Shiuli className="w-3.5 h-3.5" />
            <p className="font-display text-sona text-xs sm:text-sm tracking-[0.35em] uppercase">
              শারদীয়া উৎসব ২০২৬ · San Francisco Bay Area
            </p>
            <Shiuli className="w-3.5 h-3.5" />
          </div>

          <DurgaEye className="w-40 sm:w-52 mx-auto mt-6 text-kash" />

          <h1 className="font-display font-extrabold text-5xl sm:text-7xl mt-4 leading-[1.1] text-pandal drop-shadow-sm">
            পুজো পরিক্রমা
          </h1>
          <p className="font-display text-lg sm:text-2xl mt-2 text-sona-bright">
            এক ঠিকানায় সমগ্র বঙ্গসভ্যতার উৎসব
          </p>
          <p className="font-body text-white/85 max-w-xl mx-auto mt-4 text-sm sm:text-base">
            Every Durga Puja in the Bay Area, in one place — {pujas.length}{" "}
            pujas across 6 regions and 3 weekends, with schedules, bhog,
            tickets, and directions. Plan a parikroma and hop several pandals
            in a single day.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3 font-body text-sm font-semibold">
            <Link
              href="/pujas/"
              className="bg-pandal text-sindoor-dark rounded-full px-7 py-3 hover:bg-kash transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sona"
            >
              Browse all {pujas.length} pujas
            </Link>
            <Link
              href="/parikroma/"
              className="border border-sona/60 text-pandal rounded-full px-7 py-3 hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sona"
            >
              পরিক্রমা সাজান → Plan a route
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs text-white/70 font-body">
            <span>{withSchedule.length} with published schedules</span>
            <span>{withBhog.length} serving bhog</span>
            <span>{free.length} free entry</span>
            <span>{tba.length} awaiting 2026 dates</span>
          </div>
        </div>
        <Toran className="relative text-sona/80" />
        <div aria-hidden className="kash-row h-14 sm:h-20" />
      </section>

      {/* Tithi reference */}
      <section className="bg-kash/70 border-b border-dhunuchi/30">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 justify-center text-center">
            <p className="font-display font-semibold text-sm text-sindoor-dark">
              পঞ্জিকা অনুযায়ী তিথি · Tithi days:
            </p>
            {meta.tithiReference.map((t) => (
              <p
                key={t.date}
                className="text-xs text-ink/80 font-body flex items-center gap-1.5"
              >
                <span className="font-display font-semibold text-sindoor text-sm">
                  {tithiBn(t.date)}
                </span>
                <span className="text-stone-500">{fmtDateLong(t.date)}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Mahalaya */}
      {meta.mahalaya && (
        <section className="bg-shiuli border-b border-dhunuchi/30">
          <div className="mx-auto max-w-4xl px-4 py-8">
            <div className="text-center">
              <p className="font-display text-xs tracking-[0.3em] uppercase text-dhunuchi">
                দেবীপক্ষের সূচনা · The dawn of Devi Paksha
              </p>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl mt-2 text-sindoor-dark">
                {meta.mahalaya.title}
              </h2>
              <p className="font-body text-sm text-stone-600 mt-1">
                {meta.mahalaya.dateLabel} · {meta.mahalaya.tithi}
              </p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3 font-body text-sm text-ink/90">
              <div className="bg-white/80 border border-dhunuchi/30 rounded-2xl p-4">
                <h3 className="font-display font-bold text-sindoor-dark text-base mb-1">
                  মহালয়ার তাৎপর্য
                </h3>
                <p className="text-stone-600">{meta.mahalaya.significance}</p>
              </div>
              <div className="bg-white/80 border border-dhunuchi/30 rounded-2xl p-4">
                <h3 className="font-display font-bold text-sindoor-dark text-base mb-1">
                  মহিষাসুরমর্দিনী
                </h3>
                <p className="text-stone-600">
                  {meta.mahalaya.mahishasuramardini}
                </p>
              </div>
              <div className="bg-white/80 border border-dhunuchi/30 rounded-2xl p-4">
                <h3 className="font-display font-bold text-sindoor-dark text-base mb-1">
                  তর্পণ
                </h3>
                <p className="text-stone-600">{meta.mahalaya.tarpan}</p>
              </div>
            </div>
            <p className="text-center font-body text-xs text-stone-400 mt-4">
              Mahalaya is six days before Shashthi — the puja weekend itself
              begins Oct 16.
            </p>
          </div>
        </section>
      )}

      {/* Weekend sections */}
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-12">
        {[
          { key: "1", list: w1 },
          { key: "2", list: w2 },
          { key: "3", list: w3 },
        ].map(({ key, list }) => (
          <section key={key} className="rise-in">
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <h2 className="font-display font-bold text-2xl">
                <span className="text-dhunuchi text-lg block leading-none mb-0.5">
                  {WEEKEND_BN[key]}
                </span>
                {WEEKEND_LABELS[key]}
              </h2>
              <Link
                href={`/pujas/?weekend=${key}`}
                className="text-sm font-semibold text-sindoor hover:underline font-body whitespace-nowrap"
              >
                View weekend {key} →
              </Link>
            </div>
            <AlponaDivider className="text-dhunuchi/50 mb-4" units={30} />
            {list.length === 0 ? (
              <p className="text-stone-500 font-body text-sm">
                No pujas listed yet.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((p) => (
                  <PujaCard key={p.id} puja={p} userLoc={null} />
                ))}
              </div>
            )}
          </section>
        ))}

        <section className="rise-in">
          <h2 className="font-display font-bold text-2xl mb-1">
            <span className="text-dhunuchi text-lg block leading-none mb-0.5">
              অন্য তারিখে
            </span>
            Other published dates
          </h2>
          <AlponaDivider className="text-dhunuchi/50 mb-4" units={30} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {other.map((p) => (
              <PujaCard key={p.id} puja={p} userLoc={null} />
            ))}
          </div>
        </section>

        <section className="rise-in">
          <h2 className="font-display font-bold text-2xl mb-1">
            <span className="text-dhunuchi text-lg block leading-none mb-0.5">
              তারিখ এখনও আসেনি
            </span>
            Dates to be announced
          </h2>
          <AlponaDivider className="text-dhunuchi/50 mb-4" units={30} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tba.map((p) => (
              <PujaCard key={p.id} puja={p} userLoc={null} />
            ))}
          </div>
        </section>

        <p className="text-center font-body text-xs text-stone-400">
          {Object.entries(REGION_BN)
            .map(([, bn]) => bn)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}
