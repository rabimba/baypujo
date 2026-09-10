import type { Metadata } from "next";
import { Baloo_Da_2, Hind_Siliguri } from "next/font/google";
import Link from "next/link";
import { Shiuli } from "../components/motifs";
import Analytics from "../components/Analytics";
import { meta, city } from "../lib/pujas";
import "./globals.css";

const baloo = Baloo_Da_2({
  variable: "--font-baloo-da-2",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const hind = Hind_Siliguri({
  variable: "--font-hind-siliguri",
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: city.metaTitle,
    template: `%s · ${city.brand}`,
  },
  description: city.metaDescription,
  keywords: [
    "durga puja 2026",
    `durga puja ${city.cityLabelShort.toLowerCase()}`,
    `bengali ${city.cityLabelShort.toLowerCase()}`,
    "pujo parikrama",
  ],
};

const nav = [
  { href: "/pujas/", label: "All Pujas" },
  { href: "/parikroma/", label: "Parikroma Planner" },
  { href: "/about/", label: "About" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${baloo.variable} ${hind.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="bg-sindoor-dark text-white sticky top-0 z-50 shadow-md">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="font-display font-bold text-lg tracking-tight flex items-center gap-2 group"
            >
              <Shiuli className="w-4 h-4 text-sona shrink-0" />
              <span>
                {city.brandBn}{" "}
                <span className="hidden sm:inline font-body font-normal text-sona/90">
                  · {city.cityLabelShort}
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-4 text-sm font-body font-medium">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-2.5 py-1.5 rounded-full hover:bg-white/15 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sona"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="hairline-gold" />
        </header>
        <main className="flex-1">{children}</main>
        <Analytics />
        <footer className="bg-ink text-kash/80 text-xs font-body py-6 border-t-4 border-sindoor">
          <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <p>
              Data verified{" "}
              {new Date(meta.lastVerified + "T12:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" },
              )}{" "}
              · Built with <span aria-label="love">❤</span> by{" "}
              <a
                href={city.ownerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display text-sona hover:underline"
              >
                Rabimba
              </a>
            </p>
            <p className="font-display text-sona text-sm">
              শুভ ষষ্ঠী! শুভ দুর্গাপূজা ২০২৬
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
