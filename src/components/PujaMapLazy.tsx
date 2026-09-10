"use client";

import dynamic from "next/dynamic";

const PujaMap = dynamic(() => import("./PujaMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full rounded-2xl bg-stone-100 animate-pulse flex items-center justify-center text-stone-400 text-sm font-body">
      Loading map…
    </div>
  ),
});

export default function PujaMapLazy(props: React.ComponentProps<typeof PujaMap>) {
  return <PujaMap {...props} />;
}
