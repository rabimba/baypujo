/* E2E under GitHub Pages subpath simulation */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";

import { cityConfig, baseUrl, inMetroGeo } from "./verify-lib.mjs";
const CITY = cityConfig();
const BASE = baseUrl(CITY);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  permissions: ["geolocation"],
  geolocation: inMetroGeo(CITY),
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();
const errors = [];
const net = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("response", (r) => !r.ok() && r.url().includes(":3000") && net.push(`${r.status()} ${r.url().slice(0, 90)}`));
page.on("requestfinished", (r) => r.url().includes("gtag") && net.push("GTAG LOADED " + r.url().slice(0, 80)));

const results = [];
const log = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

// home
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
log("home loads under subpath", (await page.locator("h1").first().textContent())?.trim() === CITY.brandBn);
log("css asset under basePath loads (no unstyled flash)",
  (await page.locator(".durgo-gradient").count()) === 1);
const PUJA_COUNT = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "data", "cities", CITY.cityId, "pujas.json"),
    "utf-8",
  ),
).pujas.length;
log("all puja cards", (await page.locator("main a.group.block").count()) === PUJA_COUNT, `expected ${PUJA_COUNT}`);
await page.screenshot({ path: "/tmp/ghp-home.png" });

// client nav: home → directory (basePath-aware Link)
await page.click("text=Browse all");
await page.waitForURL("**/pujas/");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1500);
log("client nav to directory under subpath",
  page.url().includes(`${BASE}/pujas/`));
log("directory Leaflet tiles render under subpath",
  (await page.locator(".leaflet-tile").count()) > 0);
log("map tiles all load (OSM absolute URLs)",
  net.filter((n) => n.startsWith("4")).length === 0,
  net.filter((n) => n.startsWith("4")).slice(0, 2).join(" | "));
await page.screenshot({ path: "/tmp/ghp-directory.png" });

// filters work under subpath
await page.fill("input[type=search]", CITY.sampleSlugs.detail);
await page.waitForTimeout(300);
log("filter works under subpath", (await page.locator("main a.group.block").count()) === 1);

// detail
await page.click("main a.group.block");
await page.waitForURL("**/pujas/*/");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1000);
log("detail page under subpath", page.url().includes(`${BASE}/pujas/${CITY.sampleSlugs.detail}/`));
log("detail map tiles", (await page.locator(".leaflet-tile").count()) > 0);

// planner with geolocation (live itinerary — no build button)
await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
await page.click("text=Use my current location");
await page.waitForTimeout(2500);
const stops = await page.locator("ol li").count();
log("planner itinerary under subpath", stops >= 2, `stops: ${stops}`);
log("planner route map tiles", (await page.locator(".leaflet-tile").count()) > 0);
await page.screenshot({ path: "/tmp/ghp-planner.png" });

// 404 page
await page.goto(`${BASE}/404.html`, { waitUntil: "networkidle" });
log("404 page under subpath", (await page.locator("text=এই পণ্ডালটি ম্যাপে নেই").count()) === 1);

// sitemap has basePath URLs
const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
log("sitemap URLs carry subpath + real domain",
  sm.includes(`https://rabimba.github.io/${CITY.repoName}/pujas/${CITY.sampleSlugs.sitemap}/`));

// analytics: none configured → no gtag requests
log("analytics scripts absent when unconfigured",
  net.filter((n) => n.startsWith("GTA")).length === 0);

const realErrors = errors.filter((e) => !e.includes("404"));
log("no console/page errors under subpath", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n==== ${results.length - failed}/${results.length} passed ====`);
if (failed) process.exit(1);
