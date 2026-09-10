/* Far-origin UX: wrong location detected, explained, and recoverable */
import { chromium } from "playwright";
const BASE = "http://localhost:3000/baypujo";
const browser = await chromium.launch();

const results = [];
const log = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

// --- Scenario A: browser geolocation returns Tokyo (VPN/IP disaster) ---
{
  const ctx = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: { latitude: 35.68, longitude: 139.69 },
    timezoneId: "America/Los_Angeles",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
  await page.click("text=Use my current location");
  await page.waitForTimeout(2500);

  const status = await page.locator("main").innerText();
  log("geo status warns outside Bay Area", status.includes("outside the Bay Area"));
  log("start point shows resolved coords", /\(35\.680, 139\.690\)/.test(status));

  const banner = await page.locator("text=Your start point looks wrong").count();
  log("rose banner: start point looks wrong", banner === 1);
  const bannerText = await page.locator("main").innerText();
  log("banner explains miles + suggests address mode",
    /miles to the nearest puja/.test(bannerText) && bannerText.includes('enter e.g. "Fremont, CA"'));
  log("nearest-puja distance shown in summary", /nearest puja \d+ mi from start/.test(bannerText));
  log("skip reasons carry real miles", /mi away/.test(bannerText));

  await page.screenshot({ path: "/tmp/far-origin.png" });

  // recover: switch to address
  await page.click("text=Address");
  await page.fill('input[placeholder*="Leghorn"]', "Fremont, CA");
  await page.click("text=Find");
  await page.waitForTimeout(3500);
  const stops = await page.locator("ol li").count();
  log("recovery via address → itinerary builds", stops >= 2, `stops=${stops}`);
  log("banner gone after recovery",
    (await page.locator("text=Your start point looks wrong").count()) === 0);
  await page.screenshot({ path: "/tmp/far-recovered.png" });
  await ctx.close();
}

// --- Scenario B: null-island (0,0) geolocation fix ---
{
  const ctx = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: { latitude: 0, longitude: 0 },
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
  await page.click("text=Use my current location");
  await page.waitForTimeout(2000);
  const status = await page.locator("main").innerText();
  log("null-island fix rejected with guidance",
    status.includes("empty location fix") && status.includes("enter your address"));
  log("no start point set for null-island",
    (await page.locator("text=Start point set").count()) === 0);
  await ctx.close();
}

// --- Scenario C: sane Bay Area origin still perfect ---
{
  const ctx = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: { latitude: 37.4431, longitude: -122.3242 },
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
  await page.click("text=Use my current location");
  await page.waitForTimeout(2500);
  const stops = await page.locator("ol li").count();
  log("sane origin: no warning, 9:00–20:00 builds", stops >= 5, `stops=${stops}`);
  const t = await page.locator("main").innerText();
  log("no false 'looks wrong' banner", (await page.locator("text=Your start point looks wrong").count()) === 0);
  log("no geo warning for in-BA fix", !t.includes("outside the Bay Area"));
  await page.screenshot({ path: "/tmp/sane-origin.png" });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n==== ${results.length - failed}/${results.length} passed ====`);
if (failed) process.exit(1);
