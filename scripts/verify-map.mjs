import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// detail page with venue map
await page.goto(`${BASE}/pujas/sanskriti/`, { waitUntil: "networkidle" });
const mapEl = page.locator(".leaflet-container").first();
const box = await mapEl.boundingBox();
const tiles = await page.locator(".leaflet-tile").count();
// tiles must be INSIDE map container bounds
let outOfBounds = 0;
const tileBoxes = await page.locator(".leaflet-tile").evaluateAll((els, b) =>
  els.map((el) => el.getBoundingClientRect()).filter(
    (r) => r.width > 0 && (r.left < b.x - 2 || r.right > b.x + b.width + 2)
  , b),
).catch(() => []);
console.log("detail map box:", JSON.stringify(box), "| tiles:", tiles, "| stray tiles:", tileBoxes.length ?? "?");
console.log("schedule rows present:", (await page.locator("li").count()) >= 21);
console.log("page scrollWidth sane:", await page.evaluate(() => document.documentElement.scrollWidth <= 1290));

// screenshot for eyeball check
await page.screenshot({ path: "/tmp/detail-sanskriti.png", fullPage: false });

// directory
await page.goto(`${BASE}/pujas/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log("directory tiles:", (await page.locator(".leaflet-tile").count()) > 0);
console.log("directory scrollWidth sane:", await page.evaluate(() => document.documentElement.scrollWidth <= 1290));
await page.screenshot({ path: "/tmp/directory.png" });

// planner flow
await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
console.log("planner scrollWidth sane:", await page.evaluate(() => document.documentElement.scrollWidth <= 1290));

console.log("errors:", errors.length ? errors.slice(0, 3).join(" | ") : "none");
await browser.close();
