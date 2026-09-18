import type { MetadataRoute } from "next";
import { city } from "../lib/pujas";

const BASE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://rabimba.github.io"
).replace(/\/+$/, "");
const BASE_PATH = process.env.PB_BASE_PATH ?? `/${city.repoName}`;

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const root = `${BASE}${BASE_PATH}`;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${root}/sitemap.xml`,
  };
}
