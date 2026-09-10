"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { quickSupport } from "../lib/assistant-support";

const AssistantPanel = dynamic(() => import("./AssistantPanel"), {
  ssr: false,
});

/**
 * Floating on-device assistant launcher — homepage only.
 * Renders nothing during SSR/hydration; after mount, runs the full async
 * capability probe (WebGPU adapter quality or Chrome built-in AI) and only
 * then shows the launcher. Unsupported devices never see anything.
 */
export default function AssistantMount() {
  const [support, setSupport] = useState<null | boolean>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let dead = false;
    const probe = async () => {
      const { detectSupport } = await import("../lib/assistant-support");
      const s = await detectSupport();
      if (!dead) setSupport(s.supported);
    };
    // Cheap sync check first: no gpu and no LanguageModel → done.
    if (!quickSupport()) {
      void Promise.resolve().then(() => {
        if (!dead) setSupport(false);
      });
      return;
    }
    void probe();
    return () => {
      dead = true;
    };
  }, []);

  if (support !== true) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-50 bottom-4 right-4 durgo-gradient text-white rounded-full pl-4 pr-5 py-3 font-display font-bold text-sm shadow-xl hover:scale-105 active:scale-100 transition-transform print:hidden"
          aria-label="Ask the on-device pujo assistant"
        >
          🙏 Ask
        </button>
      )}
      {open && <AssistantPanel onClose={() => setOpen(false)} />}
    </>
  );
}
