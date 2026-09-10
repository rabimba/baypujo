import { chromium } from "playwright";
import { cityConfig, baseUrl } from "./verify-lib.mjs";
const CITY = cityConfig();
const BASE = baseUrl(CITY);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const check = async (path, checks, shot) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const text = await page.locator("main").innerText();
  for (const [name, ok] of checks(text)) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${path} — ${name}`);
  }
  if (shot) await page.screenshot({ path: `/tmp/${shot}.png` });
};

// Prothoma — cultural programs section
await check("/pujas/prothoma/", (t) => [
  ["Ash King concert listed", t.includes("Ash King") && t.includes("21:00")],
  ["Abhog play w/ 15:30", t.includes("Abhog") && t.includes("15:30")],
  ["Laser Disco Dandiya + ticket link", t.includes("Laser Disco Dandiya")],
  ["FREE fashion show (Chakra)", t.includes("Chakra") && t.includes("FREE")],
  ["venue = Campbell Heritage Center", t.includes("Campbell Heritage Center")],
  ["notice about venue fix", t.includes("Campbell Heritage Center")],
], "prothoma");

// Aantorik — hours + 6 programs + contact
await check("/pujas/aantorik/", (t) => [
  ["6 cultural programs", ["Saptak Bhattacharjee","Shalini Mukherjee","Bhushundir Maathe","Lazy Lamhe","Bollywood Bling","Megher Deshe Swapner Kheya"].every((s) => t.includes(s))],
  ["organizer hours shown", t.includes("ORGANIZER HOURS") && t.includes("6:00 PM – 10:00 PM")],
  ["contact email/phone", t.includes("aantorik.org@gmail.com") && t.includes("(321) 226-8674")],
  ["dates Oct 16–18", t.includes("Oct 16–18, 2026")],
], "aantorik");

// Abahan — contact + zeffy + schedule
await page.goto(`${BASE}/pujas/abahan/`, { waitUntil: "networkidle" });
{
  const t = await page.locator("main").innerText();
  const zeffyLinks = await page.locator("a[href*='zeffy.com']").count();
  const c = [
    ["contact email/phone", t.includes("Info@abahanbayarea.org") && t.includes("(585) 635-8443")],
    ["ticket page link present in DOM", zeffyLinks >= 1],
    ["schedule events rendered", /pushpanjali|5:30|17:30/i.test(t)],
    ["notice: signups closed", t.includes("signups are currently closed")],
  ];
  for (const [name, ok] of c) console.log(`${ok ? "PASS" : "FAIL"}  /pujas/abahan/ — ${name}`);
}

// Muktangan — Navrang + contacts + notice
await check("/pujas/muktangan/", (t) => [
  ["Navrang dandiya listed", t.includes("Navrang")],
  ["contact events@ + phone", t.includes("events@muktangan.us") && t.includes("(925) 642-0804")],
  ["notice: schedule coming soon", t.includes("coming soon")],
], "muktangan");

// Utsab — programs w/ ticketed
await check("/pujas/utsab/", (t) => [
  ["Chandrabindoo 9:00 PM", t.includes("Chandrabindoo") && t.includes("9:00 PM")],
  ["Mahalaxmi Iyer 7:00 PM", t.includes("Mahalaxmi Iyer") && t.includes("7:00 PM")],
  ["Ticketed badges", t.includes("Ticketed")],
  ["contact utsavpr@gmail.com", t.includes("utsavpr@gmail.com")],
], "utsab");

// Shirdi Sai — contact w/ WhatsApp note
await check("/pujas/shirdisai/", (t) => [
  ["contact + WhatsApp note", t.includes("ShirdiSaiSevak@yahoo.com") && t.includes("WhatsApp")],
  ["notice about paybee", t.includes("paybee")],
], "shirdisai");

// Planner address geocode fix — real address flow
await page.goto(`${BASE}/parikroma/`, { waitUntil: "networkidle" });
await page.click("text=Address");
await page.fill('input[placeholder*="Leghorn"]', "1901 Leghorn St, Mountain View");
await page.click("text=Find");
await page.waitForTimeout(4000);
const addr = await page.locator("text=/Found:/").allInnerTexts();
console.log(`${addr.length && addr[0].includes("Mountain View") ? "PASS" : "FAIL"}  planner — address geocode: ${addr[0] ?? "no status"}`);
await page.screenshot({ path: "/tmp/planner-fixed.png" });

// city-level address too
await page.fill('input[placeholder*="Leghorn"]', "Fremont, CA");
await page.click("text=Find");
await page.waitForTimeout(3500);
const addr2 = await page.locator("text=/Found:/").allInnerTexts();
console.log(`${addr2.length && addr2[0].includes("Fremont") ? "PASS" : "FAIL"}  planner — city geocode: ${addr2[0] ?? "no status"}`);

console.log("errors:", errors.length ? errors.slice(0, 3).join(" | ") : "none");
await browser.close();
