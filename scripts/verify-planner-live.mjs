/* Planner flow: selection-only itinerary (no auto-fill), live updates */
import { chromium } from "playwright";
import { cityConfig, baseUrl, inMetroGeo } from "./verify-lib.mjs";
const CITY = cityConfig();
const BASE = baseUrl(CITY);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  permissions: ["geolocation"],
  geolocation: inMetroGeo(CITY),
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

// 1. default prompt before origin
await goto();
log("prompt before origin", (await statusText()).includes("Set a starting point"));

// 2. origin set, nothing selected -> empty itinerary, not auto-filled
await page.click("text=Use my current location");
await page.waitForTimeout(1500);
const stopsNoneSelected = await stopCount();
log(
  "no auto-fill with nothing selected",
  stopsNoneSelected === 0,
  `stops=${stopsNoneSelected}`,
);
log("status prompts to pick pujas", (await statusText()).includes("Pick pujas"));
log(
  "empty-state explains nothing is selected yet",
  (await page.locator("text=No pujas selected yet").count()) === 1,
);

// 3. select exactly one puja -> exactly that one shows
await page.click("text=Pashchimi Durga Puja");
await page.waitForTimeout(500);
const stopsOne = await stopCount();
const firstStopText = await page.locator("ol li").first().innerText();
log("selecting one puja plans exactly one stop", stopsOne === 1, `stops=${stopsOne}`);
log("the stop is the one selected", firstStopText.includes("Pashchimi"));

// 4. select a second puja -> both show, nothing extra
await page.click("text=Aparajita Durga Puja");
await page.waitForTimeout(500);
const stopsTwo = await stopCount();
const itineraryText = await page
  .locator("ol")
  .first()
  .innerText()
  .catch(() => "");
log("selecting a second puja plans exactly two stops", stopsTwo === 2, `stops=${stopsTwo}`);
log(
  "itinerary mentions only the two selected pujas, nothing auto-added",
  itineraryText.includes("Pashchimi") &&
    itineraryText.includes("Aparajita") &&
    !itineraryText.includes("Agomoni") &&
    !itineraryText.includes("Fog Bengal"),
);

// 5. live updates (dwell/time) still respect the selection only -- never grow
//    beyond what was picked
await page.fill('input[type=time] >> nth=0', "09:00");
await page.fill('input[type=time] >> nth=1', "21:00");
await page.waitForTimeout(600);
const stopsAfterWiderWindow = await stopCount();
log(
  "wider window never adds unselected pujas",
  stopsAfterWiderWindow <= 2,
  `stops=${stopsAfterWiderWindow}`,
);

// 6. a selection that can't fit a tiny window -> honest skipped reasons,
//    not a wall of every unselected puja
await page.fill('input[type=time] >> nth=0', "13:00");
await page.fill('input[type=time] >> nth=1', "14:00");
await page.waitForTimeout(600);
const skippedHeading = await page.locator("h3").filter({ hasText: "Skipped" }).innerText().catch(() => "");
const skippedListText = await page
  .locator("h3")
  .filter({ hasText: "Skipped" })
  .locator("xpath=following-sibling::ul[1]")
  .innerText()
  .catch(() => "");
log(
  "tight window skips the picks with reasons, not everyone else",
  skippedHeading.includes("2") || skippedHeading.includes("1"),
  skippedHeading,
);
log(
  "unselected pujas never appear in the skipped list (only the 2 picks can)",
  !skippedListText.includes("Fog Bengal") && !skippedListText.includes("Durga Bari"),
  skippedListText.slice(0, 120),
);

// 7. changing date resets the selection (existing contract) -- itinerary
//    goes back to the "nothing selected" empty state, not a stale auto-fill
await page.fill('input[type=time] >> nth=0', "09:00");
await page.fill('input[type=time] >> nth=1', "21:00");
await page.locator("select").first().selectOption("2026-10-10");
await page.waitForTimeout(600);
const stopsAfterDateChange = await stopCount();
log(
  "date change clears the plan back to nothing-selected",
  stopsAfterDateChange === 0,
  `stops=${stopsAfterDateChange}`,
);

await page.screenshot({ path: "/tmp/parikroma-verify.png", fullPage: true });
console.log("errors:", errors.length ? errors.join("\n  ") : "none");
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n==== ${results.length - failed}/${results.length} passed ====`);
if (failed) process.exit(1);
