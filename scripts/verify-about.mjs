import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 900, height: 1300 } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto("http://localhost:3000/baypujo/about/", { waitUntil: "networkidle" });
const t = await p.locator("main").innerText();
const checks = [
  ["bangaliana framing", t.includes("বাঙালিয়ানা জিনিসটা আসলে কোথায় থাকে?")],
  ["no Kolkata mention", !t.includes("কলকাতা")],
  ["high-school scene", t.includes("হাইস্কুলের অডিটোরিয়াম")],
  ["jama koto holo", t.includes("জামা কত হলো")],
  ["mashima sari scene", t.includes("মাসিমা")],
  ["pujari 9-5 detail", t.includes("সফটওয়্যার ইঞ্জিনিয়ার")],
  ["kash closing line", t.includes("কাশফুল না থাক")],
  ["fallback line removed", !t.includes("Not comfortable editing JSON")],
  ["PR flow intact", t.includes("pull request") && t.includes("pujas.json")],
  ["no page errors", errors.length === 0],
];
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
await p.screenshot({ path: "/tmp/about-v3.png", fullPage: true });
await b.close();
const failed = checks.filter((c) => !c[1]).length;
console.log(`==== ${checks.length - failed}/${checks.length} ====`);
if (failed) process.exit(1);
