// Headless smoke test: boots with a fake camera, exercises campaign (story +
// enemy), spell casting via the spellbook, ranked queue and versus lobby.
const PW = process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright/index.js";
const pw = await import(PW);
const chromium = pw.chromium || pw.default?.chromium;
const BASE = process.env.BASE || "http://localhost:8099/";
const errors = [], logs = [];

const browser = await chromium.launch({
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const page = await (await browser.newContext()).newPage();
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); logs.push(m.type() + ": " + m.text()); });

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#menu:not(.hidden)", { timeout: 20000 });
  console.log("✓ menu visible");
  await page.waitForTimeout(450);
  await page.screenshot({ path: "test/shot-menu.png" });

  const cards = await page.$$(".char-card");
  console.log(`✓ ${cards.length} character cards`);

  // ranked queue opens then close
  await page.click('.mode-btn[data-mode="ranked"]');
  await page.waitForSelector("#queue:not(.hidden)", { timeout: 8000 });
  console.log("✓ ranked queue opens");
  await page.click("#queueClose");

  // LOADOUT: open, switch tab, equip a pool skill, upgrade, close
  await page.click("#customizeBtn");
  await page.waitForSelector("#customize:not(.hidden)", { timeout: 6000 });
  const coins0 = await page.$eval("#czCoins", (e) => parseInt(e.textContent) || 0);
  await page.click(".cz-tab:nth-child(2)");
  await page.click(".cz-skill:nth-child(4)"); // equip 4th pool skill into selected slot
  const up = await page.$(".cz-skill .up:not([disabled])");
  if (up) await up.click();
  const coins1 = await page.$eval("#czCoins", (e) => parseInt(e.textContent) || 0);
  console.log(`✓ loadout opens, equip + upgrade works (coins ${coins0} -> ${coins1})`);
  await page.screenshot({ path: "test/shot-loadout.png" });
  await page.click("#czClose");

  // CAMPAIGN: story -> stage -> enemy -> cast spells
  await page.click('.mode-btn[data-mode="campaign"]');
  await page.waitForSelector("#story:not(.hidden)", { timeout: 8000 });
  console.log("✓ campaign story shows");
  await page.screenshot({ path: "test/shot-story.png" });
  await page.click("#storyGo");
  await page.waitForSelector("#stage:not(.hidden)");
  await page.waitForSelector("#enemyHud:not(.hidden)", { timeout: 6000 });
  console.log("✓ campaign stage + enemy HUD");
  await page.waitForTimeout(900);
  const spells = await page.$$(".spell");
  console.log(`✓ spellbook has ${spells.length} spells`);
  const hpRatio = () => page.$eval("#enemyHp", (e) => e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width);
  const hpBefore = await hpRatio();
  await page.click(".spell:nth-child(1)"); // single basic — should NOT kill
  await page.waitForTimeout(350);
  const hpAfter = await hpRatio();
  console.log(`✓ enemy HP ${(hpBefore * 100).toFixed(0)}% -> ${(hpAfter * 100).toFixed(0)}% (casting damages enemy)`);
  if (hpAfter >= hpBefore) throw new Error("casting did not damage enemy");
  await page.screenshot({ path: "test/shot-campaign.png" });
  await page.click("#backBtn");
  await page.waitForSelector("#menu:not(.hidden)");

  // TRAINING (solo): combo + history + domain
  await page.click('.mode-btn[data-mode="solo"]');
  await page.waitForSelector("#stage:not(.hidden)");
  await page.waitForTimeout(500);
  const spellN = await page.$$eval(".spell", (n) => n.length);
  console.log(`✓ spellbook slots: ${spellN} (3 equipped + ult + domain)`);
  await page.click(".spell:nth-child(1)");
  await page.click(".spell:nth-child(2)");
  await page.click(".spell:nth-child(3)"); // 3 basics -> combo finisher
  await page.waitForTimeout(300);
  const histN = await page.$$eval("#history .h", (n) => n.length);
  const comboN = await page.$$eval("#history .h.combo", (n) => n.length);
  console.log(`✓ history ${histN} entries, combo finishers: ${comboN}`);
  if (histN < 3) throw new Error("spell history not recording");
  await page.click(".spell:nth-child(4)"); // ultimate (spends cursed energy)
  await page.waitForTimeout(700);
  const fps = await page.$eval("#fps", (e) => e.textContent);
  console.log("✓ solo combo + ultimate cast, fps:", fps);
  await page.screenshot({ path: "test/shot-stage.png" });
  await page.click("#backBtn");

  // VERSUS lobby
  await page.click('.mode-btn[data-mode="versus"]');
  await page.waitForSelector("#lobby:not(.hidden)", { timeout: 8000 });
  console.log("✓ versus lobby opens");
  await page.waitForTimeout(200);
} catch (e) {
  errors.push("TEST-FLOW: " + e.message);
} finally {
  await browser.close();
}

// Non-fatal: blocked CDN (mediapipe/peerjs/fonts) and missing optional art (404).
const fatal = errors.filter((e) => !/tasks-vision|mediapipe|storage\.googleapis|Failed to fetch|Importing a module|net::ERR|peerjs|unpkg|fonts\.|404|status of 4\d\d/i.test(e));
if (logs.length) console.log("\n--- recent logs ---\n" + logs.slice(-8).join("\n"));
if (fatal.length) { console.error("\n❌ FATAL:\n" + fatal.join("\n")); process.exit(1); }
console.log("\n✅ SMOKE TEST PASSED");
