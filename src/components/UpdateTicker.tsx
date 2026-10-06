import Link from "next/link";
import { meta } from "../lib/pujas";
import type { RecentUpdate } from "../lib/types";

export default function UpdateTicker() {
  const updates = meta.recentUpdates;
  if (!updates || updates.length === 0) return null;

  return (
    <section
      aria-label="Recent festival updates"
      className="bg-sindoor-dark/95 text-kash border-b border-sona/30 shadow-xs relative z-10"
    >
      <div className="mx-auto max-w-6xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs font-body">
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-block w-2 h-2 rounded-full bg-sona diya" aria-hidden />
          <span className="font-display font-bold uppercase tracking-wider text-sona px-2 py-0.5 rounded-full bg-white/10 text-[11px]">
            সদ্য আপডেট · Latest Updates
          </span>
        </div>

        <div className="flex-1 overflow-x-auto no-scrollbar">
          <ul className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 divide-y divide-white/10 sm:divide-y-0 text-white/90">
            {updates.map((item: RecentUpdate, idx: number) => {
              const formattedDate = new Date(item.date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });

              return (
                <li key={idx} className="flex items-baseline gap-2 pt-1 sm:pt-0 shrink-0">
                  <span className="text-sona-bright/80 font-mono text-[10px] uppercase shrink-0">
                    {formattedDate}
                  </span>
                  <span>{item.text}</span>
                  {item.pujaId ? (
                    <Link
                      href={`/pujas/${item.pujaId}`}
                      className="text-sona underline hover:text-white transition-colors shrink-0 ml-1 font-medium"
                    >
                      View pujo →
                    </Link>
                  ) : item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sona underline hover:text-white transition-colors shrink-0 ml-1 font-medium"
                    >
                      Details ↗
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
