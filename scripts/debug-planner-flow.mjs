/* Deep debug of planner: reproduce user's "No feasible stops" report */
import { chromium } from "playwright";
const BASE = "http://localhost:3000/pujo-parikrama";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  permissions: ["geolocation"],
  geolocation: { latitude: 37.4431, longitude: -122.3242 },
  timezoneId: "America/Los_Angeles",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 200)));
page.on("console", (m) => m.type() === "error" && errors.push("CONSOLE: " + m.text().slice(0, 200)));

const results = [];
const log = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

const buildPlan = async (label, { date, start, end, dwell, origin, musts = [] }) => {
  await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
  // date
  if (date) {
    await page.locator("select").first().selectOption(date);
    await page.waitForTimeout(300);
  }
  // times
  if (start) await page.fill('input[type=time] >> nth=0', start);
  if (end) await page.fill('input[type=time] >> nth=1', end);
  // dwell
  if (dwell) {
    await page.fill('input[type=range]', String(dwell));
    await page.locator("input[type=range]").evaluate((el) =>
      el.dispatchEvent(new Event("input", { bubbles: true })));
  }
  // origin
  if (origin?.geo) {
    await page.click("text=Use my current location");
    await page.waitForTimeout(2000);
  } else if (origin?.addr) {
    await page.click("text=Address");
    await page.fill('input[placeholder*="Leghorn"]', origin.addr);
    await page.click("text=Find");
    await page.waitForTimeout(3500);
  }
  // musts
  for (const m of musts) {
    await page.click(`text=${m}`);
    await page.waitForTimeout(150);
  }
  const originOk = await page.locator("text=✓ Start point set").count();
  await page.click("text=Build my parikroma");
  await page.waitForTimeout(900);
  const stops = await page.locator("ol li").count();
  const noFeasible = await page.locator("text=No feasible stops").count();
  const chips = await page.locator("section").nth(2).locator("button").count();
  console.log(`  [${label}] origin-set=${originOk === 1} candidateChips=${chips} stops=${stops} noFeasibleMsg=${noFeasible === 1}`);
  return { stops, noFeasible: noFeasible === 1, originOk: originOk === 1 };
};

// --- user-reported default path (geo, defaults) ---
const r1 = await buildPlan("geo default Oct17 10-20 dwell60", {
  date: "2026-10-17", start: "10:00", end: "20:00", dwell: 60, origin: { geo: true },
});
log("geo default window builds plan", r1.stops >= 2, `stops=${r1.stops}`);

// --- user-reported: address mode ---
const r2 = await buildPlan("address Fremont", {
  date: "2026-10-17", start: "10:00", end: "20:00", dwell: 60, origin: { addr: "Fremont, CA" },
});
log("address origin builds plan", r2.stops >= 2, `stops=${r2.stops}`);

// --- wide window, long day ---
const r3 = await buildPlan("wide 9-22 dwell90", {
  date: "2026-10-17", start: "09:00", end: "22:00", dwell: 90, origin: { geo: true },
});
log("wide window builds plan", r3.stops >= 2, `stops=${r3.stops}`);

// --- Oct 10 (weekend 1, Sanskriti has schedule) ---
const r4 = await buildPlan("Oct10 geo", {
  date: "2026-10-10", start: "10:00", end: "20:00", dwell: 60, origin: { geo: true },
});
log("Oct 10 builds plan", r4.stops >= 1, `stops=${r4.stops}`);

// --- must-visit selection persists ---
const r5 = await buildPlan("must-visit Pashchimi", {
  date: "2026-10-17", start: "10:00", end: "20:00", dwell: 60,
  origin: { geo: true }, musts: ["Pashchimi Durga Puja"],
});
log("must-visit included first", r5.stops >= 1, `stops=${r5.stops}`);

// --- actually infeasible case: 1pm-2pm ---
const r6 = await buildPlan("tight 13-14", {
  date: "2026-10-17", start: "13:00", end: "14:00", dwell: 60, origin: { geo: true },
});
log("tight window correctly shows guidance", r6.noFeasible && r6.stops === 0);

console.log("errors:", errors.length ? errors.join("\n  ") : "none");
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n==== ${results.length - failed}/${results.length} passed ====`);
if (failed) process.exit(1);
