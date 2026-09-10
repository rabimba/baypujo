import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const net = [];
page.on("response", (r) => r.url().includes("nominatim") && net.push(`${r.status()} ${r.url()}`));
page.on("console", (m) => ["error", "warning"].includes(m.type()) && net.push(`CONSOLE ${m.type()}: ${m.text().slice(0, 200)}`));

await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
await page.click("text=Address");
const input = page.locator('input[placeholder*="Leghorn"]');
console.log("address input visible:", await input.isVisible());
await input.fill("1901 Leghorn St, Mountain View");
await page.click("text=Find");
await page.waitForTimeout(4000);
const status = await page.locator("text=/Looking up|No match|Lookup failed|Found:/").allInnerTexts();
console.log("status text:", status);
console.log("network:", net.join("\n  ") || "none");
await browser.close();
