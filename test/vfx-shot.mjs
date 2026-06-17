// Charges cursed energy then fires the Special (Hollow Purple) to verify VFX render.
const PW = process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright/index.js";
const pw = await import(PW);
const chromium = pw.chromium || pw.default?.chromium;
const BASE = process.env.BASE || "http://localhost:8099/";

const browser = await chromium.launch({
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const page = await (await browser.newContext()).newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#menu:not(.hidden)", { timeout: 20000 });
await page.click('.mode-btn[data-mode="solo"]'); // Gojo (default) -> blue/purple
await page.waitForSelector("#stage:not(.hidden)");
await page.waitForTimeout(800);

const c = await page.$eval("#fx", (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });

await page.evaluate(() => { window.__pd = 0; document.getElementById("stage").addEventListener("pointerdown", () => window.__pd++, true); });

// hold to charge cursed energy (~2s)
await page.mouse.move(c.x, c.y);
await page.mouse.down();
await page.waitForTimeout(700);
console.log("  mid-hold CE:", await page.$eval("#ceFill", (e) => e.style.width), "pointerdowns:", await page.evaluate(() => window.__pd));
await page.waitForTimeout(1400);
await page.mouse.up();
await page.waitForTimeout(60);
console.log("  post-hold CE:", await page.$eval("#ceFill", (e) => e.style.width));

// double-tap = Special (Hollow Purple)
await page.mouse.click(c.x, c.y);
await page.mouse.click(c.x, c.y);

await page.waitForTimeout(520); // mid-beam
await page.screenshot({ path: "test/shot-vfx.png" });
const ce = await page.$eval("#ceFill", (e) => e.style.width);
console.log("✓ charged CE width:", ce, "→ fired special, captured test/shot-vfx.png");

await browser.close();
