/* Assistant feature-gate e2e — headless Chromium has no WebGPU and no
 * LanguageModel, so the launcher must NOT render. This verifies the
 * "unsupported devices see nothing" contract. On real hardware with
 * WebGPU, the panel flow (open → probe → engine) is exercised manually.
 */
import { chromium } from "playwright";
import { cityConfig, baseUrl } from "./verify-lib.mjs";

const CITY = cityConfig();
const BASE = baseUrl(CITY);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const results = [];
const log = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200); // hydration + gate

// Headless: no WebGPU adapter, no LanguageModel → no launcher.
const launcher = await page.locator('button[aria-label*="assistant"]').count();
log("unsupported device: launcher hidden", launcher === 0, `count=${launcher}`);

// Assistant must not appear on non-home pages even if supported.
await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const onPlanner = await page.locator('button[aria-label*="assistant"]').count();
log("assistant absent on planner page", onPlanner === 0);

// Force-support path: stub navigator.gpu so the gate passes and the
// panel UI opens. Engine init will fail (no real adapter) — the panel
// must surface a graceful error, not crash the page.
// Stub must survive navigation → install via init script, then reload home.
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.addInitScript(() => {
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: {
      requestAdapter: () =>
        Promise.resolve({
          maxStorageBufferBindingSize: 268435456,
        }),
    },
  });
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const launcher2 = await page.locator('button[aria-label*="assistant"]').count();
log("gpu-stubbed: launcher visible", launcher2 === 1, `count=${launcher2}`);
if (launcher2) {
  await page.click('button[aria-label*="assistant"]');
  await page.waitForTimeout(600);
  const dialog = await page.locator('div[role="dialog"]').count();
  log("panel opens", dialog === 1);
  const mic = await page.locator('button[aria-label*="Speak"]').count();
  log("mic button present", mic === 1);
  const input = await page.locator('input[placeholder*="Ask"]').count();
  log("text input present", input === 1);
  await page.screenshot({ path: "/tmp/assistant-panel.png" });
}

const realErrors = errors.filter(
  (e) => !e.includes("404") && !e.includes("WebGPU") && !e.includes("gpu"),
);
log("no unexpected console/page errors", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n==== ${results.length - failed}/${results.length} passed ====`);
if (failed) process.exit(1);
