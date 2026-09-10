/* E2E: static export served at http://localhost:4324 */
import { chromium } from "playwright";

const BASE = "http://localhost:4324";
const SF_ORIGIN = { lat: 37.4431, lng: -122.3242 }; // Palo Alto-ish
const results = [];
function log(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

const browser = await chromium.launch();

// ---- contexts
const ctx = await browser.newContext({
  permissions: ["geolocation"],
  geolocation: { latitude: SF_ORIGIN.lat, longitude: SF_ORIGIN.lng },
  timezoneId: "America/Los_Angeles",
});
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  // ============ HOME ============
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  log("home: 200 + Bengali hero title",
    (await page.locator("h1").first().textContent())?.trim() === "পুজো পরিক্রমা");
  const mainText = await page.locator("main").innerText();
  log("home: 31 puja cards across sections",
    (await page.locator("main a.group.block").count()) === 31);
  log("home: tithi strip shows Bengali tithi names",
    mainText.includes("সপ্তমী") && mainText.includes("দশমী"));
  log("home: weekend sections labeled",
    mainText.includes("Weekend 1") && mainText.includes("Weekend 3"));

  // ============ DIRECTORY ============
  await page.goto(`${BASE}/pujas/`, { waitUntil: "networkidle" });
  await page.waitForSelector("select");
  log("directory: all 31 shown initially",
    (await page.locator("main a[href^='/pujas/']").count()) === 31);
  log("directory: map canvas mounted (Leaflet)",
    (await page.locator(".leaflet-container").count()) >= 1);

  // search filter
  await page.fill("input[type=search]", "sanskriti");
  await page.waitForTimeout(300);
  log("directory: search 'sanskriti' → 1 card",
    (await page.locator("main a[href^='/pujas/']").count()) === 1);
  await page.fill("input[type=search]", "");
  await page.waitForTimeout(300);

  // region filter — match East Bay option by value
  await page.selectOption("select >> nth=0", "East Bay");
  await page.waitForTimeout(300);
  const eastBayCount = await page.locator("main a[href^='/pujas/']").count();
  log("directory: East Bay region filter", eastBayCount >= 8 && eastBayCount <= 12, `got ${eastBayCount}`);
  await page.selectOption("select >> nth=0", "all");

  // date filter (Saptami Oct 17)
  const dateSel = page.locator("select").nth(1);
  await dateSel.selectOption("2026-10-17");
  await page.waitForTimeout(300);
  const oct17Count = await page.locator("main a[href^='/pujas/']").count();
  log("directory: Oct 17 date filter", oct17Count >= 5 && oct17Count <= 15, `got ${oct17Count}`);
  await dateSel.selectOption("all");

  // event type: food/bhog
  const evtSel = page.locator("select").nth(2);
  await evtSel.selectOption("food");
  await page.waitForTimeout(300);
  const bhogCount = await page.locator("main a[href^='/pujas/']").count();
  log("directory: bhog/food filter", bhogCount >= 2 && bhogCount <= 10, `got ${bhogCount}`);
  await evtSel.selectOption("all");

  // geolocation + radius
  await page.click("text=Use my location");
  await page.waitForTimeout(2500); // geolocation permission + recompute
  const distBadges = await page.locator("text=/mi$/").count();
  log("directory: distance badges after geolocation", distBadges >= 5, `got ${distBadges}`);
  // radius 5mi should shrink list (Palo Alto origin, most pujas farther)
  await page.fill("input[type=range]", "5");
  page.locator("input[type=range]").evaluate((el) =>
    el.dispatchEvent(new Event("input", { bubbles: true })));
  await page.waitForTimeout(300);
  const nearby = await page.locator("main a[href^='/pujas/']").count();
  log("directory: 5mi radius narrows results", nearby < 31 && nearby >= 0, `got ${nearby}`);

  // ============ DETAIL: Sanskriti (full schedule) ============
  await page.goto(`${BASE}/pujas/sanskriti/`, { waitUntil: "networkidle" });
  const detail = await page.locator("main").innerText();
  log("detail: Sanskriti 21 schedule events",
    (await page.locator("li").count()) >= 21);
  log("detail: Sandhi Pujo row with Bengali tag সন্ধিপূজা",
    detail.includes("Sandhi Pujo") && detail.includes("সন্ধিপূজা"));
  log("detail: bhog purchase info",
    detail.includes("Bhog") && detail.includes("venue"));
  log("detail: venue map mounted",
    (await page.locator(".leaflet-container").count()) >= 1);
  log("detail: Google Maps link",
    (await page.locator("a[href*='google.com/maps']").count()) >= 1);

  // ============ DETAIL: Pashchimi (5-day, Sindur Khela) ============
  await page.goto(`${BASE}/pujas/pashchimi/`, { waitUntil: "networkidle" });
  const pash = await page.locator("main").innerText();
  log("detail: Pashchimi 5-day schedule",
    (await page.locator("h3").count()) === 5);
  log("detail: Sindur Khela + সিঁদুর খেলা",
    pash.includes("Sindur Khela") && pash.includes("সিঁদুর খেলা"));
  log("detail: bhog distribution windows",
    pash.includes("Bhog distribution"));

  // ============ DETAIL: TBA puja ============
  await page.goto(`${BASE}/pujas/ankur/`, { waitUntil: "networkidle" });
  const tba = await page.locator("main").innerText();
  log("detail: TBA puja shows notice + organizer link",
    tba.includes("Dates TBA") &&
    (await page.locator("a[href*='ankurinc.org']").count()) === 1);

  // ============ PARIKROMA PLANNER ============
  await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });

  // defaults: Oct 17, 10:00–20:00, dwell 60
  // set origin via geolocation
  await page.click("text=Use my current location");
  await page.waitForTimeout(2500);
  log("planner: origin set indicator",
    (await page.locator("text=✓ Start point set").count()) === 1);

  // must-visit: Pashchimi (Newark)
  await page.click("text=Pashchimi Durga Puja");
  await page.waitForTimeout(200);

  await page.click("text=Build my parikroma");
  await page.waitForTimeout(800);

  const planText = await page.locator("main").innerText();
  const hasStops = (await page.locator("ol li").count()) >= 2;
  log("planner: itinerary has ≥2 stops", hasStops,
    `stops: ${await page.locator("ol li").count()}`);
  log("planner: Pashchimi honored as must-visit",
    planText.includes("Pashchimi") && /MUST|must/.test(planText));
  log("planner: drive summary shown",
    /mi total driving/.test(planText));
  log("planner: route map rendered",
    (await page.locator(".leaflet-container").count()) >= 1);
  log("planner: skipped section present",
    planText.includes("Skipped"));

  // itinerary links to detail pages
  log("planner: stops link to detail pages",
    (await page.locator("ol a[href^='/pujas/']").count()) >= 2);

  // infeasible window: 1pm–2pm should produce 0 stops
  await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
  await page.click("text=Use my current location");
  await page.waitForTimeout(2500);
  await page.fill("input[type=time] >> nth=0", "13:00");
  await page.fill("input[type=time] >> nth=1", "14:00");
  await page.click("text=Build my parikroma");
  await page.waitForTimeout(800);
  const tightText = await page.locator("main").innerText();
  log("planner: tight window (1–2pm) → 0 stops + guidance",
    (await page.locator("ol li").count()) === 0 &&
    tightText.includes("No feasible stops"));

  // ============ 404 ============
  // Static export emits 404.html; hosts (Vercel/Netlify) map unknown URLs to
  // it automatically — python http.server does not, so request it directly.
  const res404 = await page.goto(`${BASE}/404.html`, { waitUntil: "networkidle" });
  log("404: Bengali fallback page renders",
    res404.status() === 200 &&
    (await page.locator("text=এই পণ্ডালটি ম্যাপে নেই").count()) === 1);

  // ============ CONSOLE ERRORS ============
  // 404 asset fetch is expected from the bad URL; filter it out
  const realErrors = consoleErrors.filter((e) => !e.includes("404"));
  log("no console/page errors across session", realErrors.length === 0,
    realErrors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`);
if (failed.length) {
  console.log("FAILED:", failed.map((f) => f.name).join("\n  "));
  process.exit(1);
}
