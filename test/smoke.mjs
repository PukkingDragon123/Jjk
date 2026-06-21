// Headless smoke test for the hand-sign sequence game (fake camera).
const PW = process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright/index.js";
const pw = await import(PW);
const chromium = pw.chromium || pw.default?.chromium;
const BASE = process.env.BASE || "http://localhost:8099/";
const errors = [], logs = [];

const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext()).newPage();
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); logs.push(m.type() + ": " + m.text()); });
const clickSign = async (s) => page.click(`.pkey[data-sign="${s}"]`);

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#menu:not(.hidden)", { timeout: 20000 });
  console.log("✓ menu visible");
  console.log(`✓ ${(await page.$$(".char-card")).length} character cards`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test/shot-menu.png" });

  // TRIAL: read the required sequence and perform it correctly
  await page.click('.mode-btn[data-mode="trial"]');
  await page.waitForSelector("#stage:not(.hidden)");
  await page.waitForSelector("#seqRow .tile", { timeout: 6000 });
  console.log(`✓ trial started, palette keys: ${(await page.$$(".pkey")).length}`);
  let seq = (await page.$eval("#seqRow", (e) => e.dataset.seq)).split(" ");
  for (const s of seq) { await clickSign(s); await page.waitForTimeout(80); }
  // sequence only PRIMES the technique — must release (clap/point) to cast
  await page.waitForSelector("#releaseBtn.show", { timeout: 3000 });
  const midScore = await page.$eval("#score", (e) => parseInt(e.textContent) || 0);
  if (midScore !== 0) throw new Error("scored before releasing — release gate not working");
  await page.click("#releaseBtn");
  await page.waitForTimeout(300);
  const score = await page.$eval("#score", (e) => parseInt(e.textContent) || 0);
  console.log(`✓ wove [${seq.join(" ")}], primed, released → score ${score}`);
  if (score <= 0) throw new Error("correct sequence + release did not score");
  await page.screenshot({ path: "test/shot-trial.png" });

  // wait for next round, then a WRONG sign ends the run
  await page.waitForTimeout(900);
  seq = (await page.$eval("#seqRow", (e) => e.dataset.seq)).split(" ");
  const wrong = ["fist", "open", "one", "two"].find((s) => s !== seq[0]);
  await clickSign(wrong);
  await page.waitForSelector("#gameover:not(.hidden)", { timeout: 4000 });
  console.log("✓ wrong sign ends the run (game over shows)");
  await page.click("#goMenuBtn");
  await page.waitForSelector("#menu:not(.hidden)");

  // TRAINING: book renders, signs castable
  await page.click('.mode-btn[data-mode="training"]');
  await page.waitForSelector("#stage:not(.hidden)");
  await page.waitForSelector(".chip", { timeout: 6000 });
  console.log(`✓ training book: ${(await page.$$(".chip")).length} techniques`);
  await clickSign("open"); await clickSign("fist"); // Gojo Blue → primes
  await page.waitForSelector("#releaseBtn.show", { timeout: 3000 });
  await page.click("#releaseBtn");                  // point-release to cast
  await page.waitForTimeout(300);
  console.log("✓ training: wove + released a technique");
  await page.screenshot({ path: "test/shot-training.png" });
  await page.click("#backBtn");

  // VERSUS lobby
  await page.click('.mode-btn[data-mode="versus"]');
  await page.waitForSelector("#lobby:not(.hidden)", { timeout: 8000 });
  console.log("✓ versus lobby opens");
} catch (e) { errors.push("TEST-FLOW: " + e.message); }
finally { await browser.close(); }

const fatal = errors.filter((e) => !/tasks-vision|mediapipe|storage\.googleapis|Failed to fetch|Importing a module|net::ERR|peerjs|unpkg|fonts\.|404|status of 4\d\d/i.test(e));
if (logs.length) console.log("\n--- recent logs ---\n" + logs.slice(-6).join("\n"));
if (fatal.length) { console.error("\n❌ FATAL:\n" + fatal.join("\n")); process.exit(1); }
console.log("\n✅ SMOKE TEST PASSED");
