import type { NextConfig } from "next";

// For GitHub Pages project sites, set PB_BASE_PATH=/<repo-name> at build time
const basePath = process.env.PB_BASE_PATH?.replace(/\/+$/, "") ?? "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
