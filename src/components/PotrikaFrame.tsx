import type { ReactNode } from "react";
import { AlponaDivider, DurgaEye, KaashPhool, Shiuli } from "./motifs";

/**
 * Sharadiya-potrika (festival magazine) styled frame: aged cream paper,
 * alpona dot borders, kash sprays in the corners, a faint পূ watermark,
 * and a masthead with the Durga eye.
 */
export default function PotrikaFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative rounded-3xl overflow-hidden shadow-sm"
      style={{
        background:
          "linear-gradient(160deg, #f9f4ea 0%, #f5e9d0 55%, #f1dfc0 100%)",
      }}
    >
      {/* alpona dotted double border */}
      <div
        aria-hidden
        className="absolute inset-3 rounded-2xl border border-dhunuchi/40 pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute inset-4 rounded-xl border border-dhunuchi/25 pointer-events-none"
      />

      {/* corner kash sprays */}
      <KaashPhool
        className="absolute -left-3 -bottom-4 h-44 text-dhunuchi/20 pointer-events-none"
        aria-hidden
      />
      <KaashPhool
        className="absolute -right-3 -bottom-4 h-44 text-dhunuchi/20 pointer-events-none"
        flip
      />

      {/* faint watermark letter */}
      <span
        aria-hidden
        className="absolute right-6 top-1/2 -translate-y-1/2 font-display font-extrabold text-[16rem] leading-none text-sindoor/[0.05] select-none pointer-events-none hidden sm:block"
      >
        পূ
      </span>

      <div className="relative px-6 py-10 sm:px-12 sm:py-12">
        {/* masthead */}
        <p className="text-center font-display text-xs tracking-[0.35em] uppercase text-dhunuchi">
          শারদীয়া পত্রিকা · প্রবাস সংখ্যা · ২০২৬
        </p>
        <DurgaEye className="w-28 mx-auto mt-3 text-sindoor/70" />
        <div className="flex items-center justify-center gap-3 mt-3 text-sindoor/60">
          <Shiuli className="w-3 h-3" />
          <span className="font-display text-sm">।। প্রবাসে পূজা ।।</span>
          <Shiuli className="w-3 h-3" />
        </div>

        {children}

        <AlponaDivider className="text-dhunuchi/50 mt-8" units={24} />
        <p className="text-center font-display text-xs text-dhunuchi mt-1 tracking-widest">
          ঢাকের শব্দে সুর বাঁধা — এই পাতা সেই সুরেরই
        </p>
      </div>
    </div>
  );
}
