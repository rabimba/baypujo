"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const GOATCOUNTER_CODE = process.env.NEXT_PUBLIC_GOATCOUNTER_CODE;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    goatcounter?: (args: { path: string }) => void;
  }
}

/**
 * Privacy-friendly by default: renders nothing unless an analytics ID is
 * configured at build time. Supports GA4 and GoatCounter simultaneously
 * or individually. Pageviews are tracked on initial load and on every
 * client-side route change.
 */
export default function Analytics() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (GA_ID && typeof window.gtag === "function") {
      window.gtag("config", GA_ID, { page_path: pathname });
    }
    if (GOATCOUNTER_CODE && typeof window.goatcounter === "function") {
      window.goatcounter({ path: pathname });
    }
  }, [pathname]);

  if (!GA_ID && !GOATCOUNTER_CODE) return null;

  return (
    <>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GA_ID}', { page_path: window.location.pathname });`}
          </Script>
        </>
      )}
      {GOATCOUNTER_CODE && (
        <Script
          src="https://gc.zgo.at/count.js"
          strategy="afterInteractive"
          {...({
            "data-goatcounter": `https://${GOATCOUNTER_CODE}.goatcounter.com/count`,
          } as Record<string, string>)}
        />
      )}
    </>
  );
}
