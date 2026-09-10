/* Planner flow: live itinerary (no Build button), all input modes */
import { chromium } from "playwright";
const BASE = "http://localhost:3000/baypujo";
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

const goto = async () => {
  await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
};
const stopCount = () => page.locator("ol li").count();
const statusText = () =>
  page.locator('[aria-live="polite"]').innerText().catch(() => "");

// 1. default + geo → itinerary appears WITHOUT any build click
await goto();
log("prompt before origin", (await statusText()).includes("Set a starting point"));
await page.click("text=Use my current location");
await page.waitForTimeout(2000);
const stops1 = await stopCount();
log("live itinerary after geo (no click)", stops1 >= 2, `stops=${stops1}`);
log("status bar shows count", (await statusText()).includes("planned"));

// 2. change dwell → itinerary updates live
await page.fill('input[type=range]', "45");
await page.locator('input[type=range]').evaluate((el) =>
  el.dispatchEvent(new Event("input", { bubbles: true })));
await page.waitForTimeout(600);
const stops2 = await stopCount();
log("dwell change updates live", stops2 >= stops1 - 1 && stops2 >= 2, `stops=${stops2}`);

// 3. change time window live
await page.fill('input[type=time] >> nth=0', "09:00");
await page.fill('input[type=time] >> nth=1', "21:00");
await page.waitForTimeout(600);
const stops3 = await stopCount();
log("wider window updates live", stops3 >= stops2, `stops=${stops3}`);

// 4. change date live
await page.locator("select").first().selectOption("2026-10-10");
await page.waitForTimeout(600);
const stops4 = await stopCount();
log("date change updates live", stops4 >= 1, `stops=${stops4}`);

// 5. address mode
await goto();
await page.click("text=Address");
await page.fill('input[placeholder*="Leghorn"]', "1901 Leghorn St, Mountain View");
await page.click("text=Find");
await page.waitForTimeout(3500);
const stops5 = await stopCount();
log("live itinerary after address", stops5 >= 2, `stops=${stops5}`);

// 6. must-visit chips live
await goto();
await page.click("text=Use my current location");
await page.waitForTimeout(2000);
await page.click("text=Pashchimi Durga Puja");
await page.waitForTimeout(500);
const first = await page.locator("ol li").first().innerText();
log("must-visit pinned first", first.includes("Pashchimi") && first.includes("MUST"));

// 7. infeasible window shows actionable guidance
await page.fill('input[type=time] >> nth=0', "13:00");
await page.fill('input[type=time] >> nth=1', "14:00");
await page.fill('input[type=range]', "180");
await page.locator('input[type=range]').evaluate((el) =>
  el.dispatchEvent(new Event("input", { bubbles: true })));
await page.waitForTimeout(900);
const guidance = await page.locator("text=No pujas fit this window yet").count();
const skipped = await page.locator("h3").filter({ hasText: "Skipped" }).count();
log("guidance + skipped list for tight window", guidance === 1 && skipped >= 1);

// 8. date with a single far puja (Oct 24 — Utsab only)
await page.locator("select").first().selectOption("2026-10-24");
await page.waitForTimeout(900);
const stopsFar = await stopCount();
log("Oct 24 (single Sacramento puja) handled sanely", stopsFar <= 1, `stops=${stopsFar}`);

console.log("errors:", errors.length ? errors.join("\n  ") : "none");
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n==== ${results.length - failed}/${results.length} passed ====`);
if (failed) process.exit(1);
