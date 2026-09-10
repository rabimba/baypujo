"use client";

import { useMemo, useState } from "react";
import {
  buildShareQuery,
  buildShareText,
  buildShareTextCompact,
  drawPlanCanvas,
  type ShareContext,
} from "../lib/share";

async function planImageFile(
  ctx: ShareContext,
  siteUrl: string,
): Promise<File | null> {
  try {
    const canvas = await drawPlanCanvas(ctx, siteUrl);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/png"),
    );
    if (!blob || typeof File === "undefined") return null;
    return new File([blob], "pujo-parikrama-plan.png", { type: "image/png" });
  } catch {
    return null;
  }
}

const isMobile = () =>
  typeof navigator !== "undefined" &&
  /android|iphone|ipad|ipod/i.test(navigator.userAgent);

export default function ShareBar({
  ctx,
  siteUrl,
}: {
  ctx: ShareContext;
  siteUrl: string;
}) {
  const [copied, setCopied] = useState("");
  const [imgBusy, setImgBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState("");
  const [modalKind, setModalKind] = useState<"whatsapp" | "sms">("whatsapp");

  const fullText = useMemo(() => buildShareText(ctx, siteUrl), [ctx, siteUrl]);
  const compactText = useMemo(
    () => buildShareTextCompact(ctx, siteUrl),
    [ctx, siteUrl],
  );

  // prefill link carries plan inputs (not the plan itself — recipient's
  // planner re-runs with same data, always current)
  const planUrl = useMemo(() => {
    const q = buildShareQuery({
      date: ctx.date,
      start: ctx.startTime,
      end: ctx.endTime,
      dwell: ctx.dwellMin,
      must: ctx.result.stops.filter((s) => s.isMustVisit).map((s) => s.puja.id),
      ...(ctx.originLat != null && ctx.originLng != null
        ? { lat: ctx.originLat, lng: ctx.originLng }
        : {}),
      ...(ctx.originLabel ? { label: ctx.originLabel } : {}),
    });
    return `${siteUrl.replace(/\/+$/, "")}/parikroma/?${q}`;
  }, [ctx, siteUrl]);

  const textWithLink = `${fullText}\n\nPlan again → ${planUrl}`;

  const flash = (msg: string) => {
    setCopied(msg);
    setTimeout(() => setCopied(""), 2600);
  };

  /** WhatsApp: mobile → native share sheet WITH the image card;
   *  desktop → wa.me text (opened synchronously to survive popup
   *  blockers) + card downloaded to attach. */
  const whatsapp = async () => {
    if (isMobile() && navigator.share) {
      const file = await planImageFile(ctx, siteUrl);
      if (file && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Pujo Parikrama Plan",
            text: textWithLink,
          });
          return;
        } catch {
          /* cancelled or unsupported → fall through to wa.me */
        }
      }
    }
    const url = `https://wa.me/?text=${encodeURIComponent(textWithLink)}`;
    if (isMobile()) {
      window.location.href = url;
      return;
    }
    // desktop: open chat in-gesture, THEN stage the card (async work after
    // window.open keeps it clear of popup blockers)
    const win = window.open(url, "_blank", "noopener");
    const file = await planImageFile(ctx, siteUrl);
    setModalKind("whatsapp");
    setModalUrl(url);
    setModalOpen(true);
    if (file) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    if (!win) {
      // popup was blocked — modal offers a manual link
      flash("Popup blocked — use the link in the dialog below");
    }
  };

  /** Messages/SMS: mobile → native share sheet WITH the image (iMessage
   *  keeps the attachment); desktop → sms: link + card staged. */
  const sms = async () => {
    if (isMobile() && navigator.share) {
      const file = await planImageFile(ctx, siteUrl);
      if (file && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Pujo Parikrama Plan",
            text: compactText,
          });
          return;
        } catch {
          /* fall through */
        }
      }
    }
    const body = `${compactText}\n${planUrl}`;
    const url = `sms:?&body=${encodeURIComponent(body)}`;
    if (isMobile()) {
      window.location.href = url;
      return;
    }
    const file = await planImageFile(ctx, siteUrl);
    setModalKind("sms");
    setModalUrl(url);
    setModalOpen(true);
    if (file) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  /** More… — native sheet with image card wherever files are shareable. */
  const nativeShare = async () => {
    if (navigator.share) {
      const file = await planImageFile(ctx, siteUrl);
      try {
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Pujo Parikrama Plan",
            text: textWithLink,
          });
          return;
        }
        await navigator.share({
          title: "Pujo Parikrama Plan",
          text: textWithLink,
        });
      } catch {
        // user cancelled
      }
    } else {
      flash("Native share not available here — use WhatsApp or copy");
    }
  };

  const copy = async (what: "text" | "link") => {
    const content = what === "text" ? textWithLink : planUrl;
    try {
      await navigator.clipboard.writeText(content);
      flash(what === "text" ? "Plan copied" : "Link copied");
    } catch {
      flash("Copy failed — select the text manually");
    }
  };

  const downloadPng = async () => {
    setImgBusy(true);
    try {
      const canvas = await drawPlanCanvas(ctx, siteUrl);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `pujo-parikrama-${ctx.date}.png`;
      a.click();
      flash("Image saved");
    } catch {
      flash("Could not generate image");
    } finally {
      setImgBusy(false);
    }
  };

  const printPdf = () => window.print();

  const btn =
    "rounded-xl px-3.5 py-2 text-sm font-semibold border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sindoor disabled:opacity-50";

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 font-body print:hidden">
      <h3 className="font-display font-bold text-lg">
        <span className="text-dhunuchi text-sm block leading-none mb-0.5">
          পরিক্রমা ভাগ করুন
        </span>
        Share your parikroma
      </h3>
      <p className="text-xs text-stone-500 mt-1">
        Every share includes the branded image card + a link that prefills
        this exact plan on any device.
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={whatsapp}
          className={`${btn} bg-[#25D366] text-white border-[#25D366] hover:bg-[#1eb85a]`}
          aria-label="Share plan card on WhatsApp"
        >
          WhatsApp
        </button>
        <button
          onClick={sms}
          className={`${btn} bg-white text-ink border-stone-300 hover:border-sindoor`}
          aria-label="Share plan card via Messages or SMS"
        >
          Messages / SMS
        </button>
        <button
          onClick={nativeShare}
          className={`${btn} bg-sindoor text-white border-sindoor hover:bg-sindoor-dark`}
          aria-label="More share options with image card"
        >
          More…
        </button>
        <button
          onClick={() => copy("text")}
          className={`${btn} bg-white text-ink border-stone-300 hover:border-sindoor`}
        >
          {copied === "Plan copied" ? "✓ Copied" : "Copy plan"}
        </button>
        <button
          onClick={() => copy("link")}
          className={`${btn} bg-white text-ink border-stone-300 hover:border-sindoor`}
        >
          {copied === "Link copied" ? "✓ Copied" : "Copy link"}
        </button>
        <button
          onClick={downloadPng}
          disabled={imgBusy}
          className={`${btn} bg-ink text-kash border-ink hover:bg-[#3d2a20]`}
        >
          {imgBusy ? "Generating…" : "Image (.png)"}
        </button>
        <button
          onClick={printPdf}
          className={`${btn} bg-white text-ink border-stone-300 hover:border-sindoor`}
        >
          PDF (print)
        </button>
      </div>
      {copied && copied !== "Plan copied" && copied !== "Link copied" && (
        <p className="text-xs text-stone-500 mt-2">{copied}</p>
      )}

      {/* Desktop helper: wa.me/sms can't carry images — we opened the chat
          with text and downloaded the card; this modal walks the attach. */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-ink/60 grid place-items-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Attach the image card"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 font-body rise-in">
            <h4 className="font-display font-bold text-xl text-sindoor-dark">
              {modalKind === "whatsapp" ? "WhatsApp opened" : "Messages draft ready"}
            </h4>
            <p className="text-sm text-stone-700 mt-2">
              Web WhatsApp/SMS can&apos;t receive an image from a link, so we
              did two things:
            </p>
            <ol className="list-decimal pl-5 text-sm text-stone-700 mt-2 space-y-1">
              <li>
                {modalKind === "whatsapp"
                  ? "Opened WhatsApp with the full plan text"
                  : "Prepared your SMS with the compact plan"}
              </li>
              <li>
                Downloaded <strong>pujo-parikrama-plan.png</strong> — the
                branded plan card
              </li>
              <li className="text-stone-500">
                Attach that image in the chat (drag or 📎) and send
              </li>
            </ol>
            <p className="text-xs text-stone-500 mt-3">
              On a phone, the WhatsApp / Messages buttons share the image
              card directly — no attaching needed.
            </p>
            <div className="mt-4 flex gap-2 justify-end">
              {modalKind === "sms" && (
                <a
                  href={modalUrl}
                  className="rounded-xl bg-white border border-stone-300 px-4 py-2 text-sm font-semibold hover:border-sindoor"
                >
                  Open Messages
                </a>
              )}
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-xl bg-sindoor text-white px-4 py-2 text-sm font-semibold hover:bg-sindoor-dark"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
