/* Share v2 E2E: image card in WhatsApp/SMS flow, branding on all paths */
import { chromium } from "playwright";
import fs from "fs";
const BASE = "http://localhost:3000/pujo-parikrama";
const browser = await chromium.launch();

const results = [];
const log = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

const ctx = await browser.newContext({
  permissions: ["geolocation"],
  geolocation: { latitude: 37.4319231, longitude: -121.8952529 },
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 150)));

await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
await page.click("text=Use my current location");
await page.waitForTimeout(2500);
log("plan built", (await page.locator("ol li").count()) >= 2);

// ---- WhatsApp (desktop UA): wa.me popup + card download + attach modal ----
const dl1 = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
const waPromise = page.waitForEvent("popup", { timeout: 8000 }).catch(() => null);
await page.click('button:has-text("WhatsApp")');
const [dlA, popA] = await Promise.all([dl1, waPromise]);
log("WhatsApp: wa.me popup opens", !!popA);
log("WhatsApp: branded card auto-downloaded", !!dlA);
if (popA) {
  const decoded = decodeURIComponent(
    popA.url().replace("https://wa.me/?text=", "").replace(/\+/g, " "),
  );
  log("WhatsApp text carries brand line",
    decoded.includes("planned on Bay Area Pujo Parikrama"));
  log("WhatsApp text carries plan link w/ basePath",
    decoded.includes("localhost:3000/pujo-parikrama/parikroma/?date="));
  await popA.close().catch(() => {});
}
if (dlA) {
  await dlA.saveAs("/tmp/whatsapp-card.png");
  const kb = Math.round(fs.statSync("/tmp/whatsapp-card.png").size / 1024);
  log("WhatsApp card file valid", kb > 20, `${kb} KB`);
}
log("attach-guidance modal shown (desktop)",
  (await page.locator("text=Web WhatsApp/SMS can").count()) === 1 &&
  (await page.locator('button:has-text("Got it")').count()) === 1);
await page.click('button:has-text("Got it")');
log("modal dismissible", (await page.locator("text=Web WhatsApp/SMS can").count()) === 0);

// ---- SMS (desktop): modal + Open Messages + card download ----
const dl2 = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
await page.click('button:has-text("Messages / SMS")');
const dlB = await dl2;
log("SMS: branded card auto-downloaded", !!dlB);
log("SMS modal: Messages draft ready",
  (await page.locator("text=Messages draft ready").count()) === 1);
const openMsg = await page.locator('a:has-text("Open Messages")').count();
log("SMS modal has Open Messages action", openMsg === 1);
await page.click('button:has-text("Got it")');

// ---- PNG button still works with new signature ----
const dl3 = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
await page.click('button:has-text("Image (.png)")');
const dlC = await dl3;
log("PNG button downloads card", !!dlC);
if (dlC) {
  await dlC.saveAs("/tmp/brand-card.png");
}

log("no console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n==== ${results.length - failed}/${results.length} passed ====`);
if (failed) process.exit(1);
