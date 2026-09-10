import type { MetadataRoute } from "next";
import { pujas } from "../lib/pujas";

const BASE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://rabimba.github.io"
).replace(/\/+$/, "");
const BASE_PATH = process.env.PB_BASE_PATH?.replace(/\/+$/, "") ?? "";

export const dynamic = "force-static";

const url = (path: string) => `${BASE}${BASE_PATH}${path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: url("/"), lastModified: now, priority: 1 },
    { url: url("/pujas/"), lastModified: now, priority: 0.9 },
    { url: url("/parikroma/"), lastModified: now, priority: 0.9 },
    { url: url("/about/"), lastModified: now, priority: 0.4 },
  ];
  const pujaPages: MetadataRoute.Sitemap = pujas.map((p) => ({
    url: url(`/pujas/${p.id}/`),
    lastModified: now,
    priority: 0.8,
  }));
  return [...staticPages, ...pujaPages];
}
