"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { meta } from "../lib/pujas";
import type { RecentUpdate } from "../lib/types";

export default function UpdateTicker() {
  const updates = meta.recentUpdates;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!updates || updates.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % updates.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [updates, isPaused]);

  if (!updates || updates.length === 0) return null;

  const current = updates[currentIndex];
  const formattedDate = new Date(current.date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <section
      aria-label="Recent festival updates"
      className="bg-sindoor-dark/95 text-kash border-b border-sona/30 shadow-xs relative z-10 transition-colors"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between gap-3 text-xs font-body min-h-[38px]">
        {/* Left: Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-block w-2 h-2 rounded-full bg-sona diya" aria-hidden />
          <span className="font-display font-semibold uppercase tracking-wider text-sona px-2 py-0.5 rounded-full bg-white/10 text-[11px] whitespace-nowrap">
            সদ্য আপডেট · Latest Updates
          </span>
        </div>

        {/* Center: Single active update with smooth cross-fade */}
        <div className="flex-1 min-w-0 flex items-center gap-2.5 overflow-hidden">
          <span className="text-sona-bright font-mono text-[10px] uppercase shrink-0 bg-black/20 px-1.5 py-0.5 rounded">
            {formattedDate}
          </span>
          <span className="truncate text-white/95" title={current.text}>
            {current.text}
          </span>
          {current.pujaId ? (
            <Link
              href={`/pujas/${current.pujaId}`}
              className="text-sona hover:text-white underline underline-offset-2 transition-colors shrink-0 font-medium"
            >
              View pujo →
            </Link>
          ) : current.link ? (
            <a
              href={current.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sona hover:text-white underline underline-offset-2 transition-colors shrink-0 font-medium"
            >
              Details ↗
            </a>
          ) : null}
        </div>

        {/* Right: Controls & counter */}
        {updates.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0 text-white/60">
            <span className="font-mono text-[10px] text-white/50 hidden sm:inline">
              {currentIndex + 1} / {updates.length}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((prev) => (prev - 1 + updates.length) % updates.length)
                }
                aria-label="Previous update"
                className="p-1 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev + 1) % updates.length)}
                aria-label="Next update"
                className="p-1 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
