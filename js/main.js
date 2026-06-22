// JUJUTSU WEB — perform hand-sign sequences to unleash cursed techniques.
// Modes: Trial (memory + accuracy run), Training (free practice), Versus (duel).
import { CHARACTERS, getCharacter } from "./characters.js";
import { signOf } from "./signs.js";
import { Tracker } from "./tracking.js";
import { GestureEngine } from "./gestures.js";
import { ParticleSystem } from "./vfx/particles.js";
import { EffectManager } from "./vfx/techniques.js";
import { Versus } from "./multiplayer.js";
import { composeShot, postShot } from "./capture.js";
import * as audio from "./audio.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const els = {
  boot: $("#boot"), bootBar: $("#bootBar"), bootMsg: $("#bootMsg"),
  menu: $("#menu"), charGrid: $("#charGrid"),
  stage: $("#stage"), video: $("#video"), fx: $("#fx"),
  score: $("#score"), best: $("#best"), rightLbl: $("#rightLbl"), modeName: $("#modeName"),
  vsBars: $("#vsBars"), p1Name: $("#p1Name"), p2Name: $("#p2Name"), p1Hp: $("#p1Hp"), p2Hp: $("#p2Hp"), oppVideo: $("#oppVideo"),
  scroll: $("#scroll"), tLabel: $("#tLabel"), techName: $("#techName"), seqRow: $("#seqRow"), timeBar: $("#timeBar"),
  combo: $("#combo"), banner: $("#banner"), techFlash: $("#techFlash"), statusTag: $("#statusTag"),
  cutin: $("#cutin"), cutinInit: $("#cutinInit"), cutinName: $("#cutinName"),
  signNow: $("#signNow"), signNowGlyph: $("#signNowGlyph"), palette: $("#palette"),
  castPrompt: $("#castPrompt"), releaseBtn: $("#releaseBtn"),
  backBtn: $("#backBtn"), captureBtn: $("#captureBtn"), soundBtn: $("#soundBtn"), mirrorBtn: $("#mirrorBtn"),
  fps: $("#fps"), gallery: $("#gallery"),
  gameover: $("#gameover"), goTitle: $("#goTitle"), goScore: $("#goScore"), goBest: $("#goBest"), goMsg: $("#goMsg"),
  retryBtn: $("#retryBtn"), goMenuBtn: $("#goMenuBtn"),
  lobby: $("#lobby"), createRoom: $("#createRoom"), joinRoom: $("#joinRoom"), roomInput: $("#roomInput"),
  lobbyCode: $("#lobbyCode"), codeText: $("#codeText"), copyCode: $("#copyCode"), lobbyStatus: $("#lobbyStatus"), lobbyClose: $("#lobbyClose"),
  help: $("#help"), helpBody: $("#helpBody"), helpClose: $("#helpClose"), howToBtn: $("#howToBtn"),
};
const SIGN_KEYS = ["fist", "open", "one", "two", "double", "pray"];

const ctx = els.fx.getContext("2d");
const bloomA = document.createElement("canvas"), bloomB = document.createElement("canvas"); // downsample bloom chain
const bctxA = bloomA.getContext("2d"), bctxB = bloomB.getContext("2d");
const tracker = new Tracker();
const gestures = new GestureEngine();
const particles = new ParticleSystem(1200);
const effects = new EffectManager(particles);

const state = {
  mode: "menu", char: CHARACTERS[0], mirror: true, running: false,
  // trial
  score: 0, best: +(localStorage.getItem("jjkw_best") || 0), combo: 0, round: 0,
  target: null, idx: 0, roundTime: 7, timeLeft: 7, studyLeft: 0, hideSigns: false, over: false, lock: 0, pendingNext: false,
  // prime / release
  primed: null, release: null,
  // free (training/versus)
  buf: [], maxLen: 4,
  // versus
  selfHp: 100, oppHp: 100, oppChar: "gojo",
  aimPos: null,
};
let stream = null, versus = null, lastFrame = performance.now(), fpsT = 0, fpsN = 0;
const artCache = {};

/* ---------- boot ---------- */
async function boot() {
  for (const c of CHARACTERS) { if (!c.art) continue; const img = new Image(); img.onload = () => (artCache[c.id] = img); img.src = c.art; }
  buildCharGrid(); buildPalette(); buildHelp(); wireUI(); setupClips();
  let p = 0;
  const tick = setInterval(() => { p = Math.min(0.85, p + 0.05); els.bootBar.style.width = p * 100 + "%"; }, 120);
  const mode = await tracker.init((v, msg) => { p = Math.max(p, v); els.bootBar.style.width = p * 100 + "%"; if (msg) els.bootMsg.textContent = msg; });
  clearInterval(tick); els.bootBar.style.width = "100%";
  els.bootMsg.textContent = mode === "hands" ? "cursed sight online." : "tap-the-signs mode (no camera AI).";
  setTimeout(() => { els.boot.classList.add("hidden"); els.menu.classList.remove("hidden"); }, 450);
}

/* ---------- menu ---------- */
function buildCharGrid() {
  els.charGrid.innerHTML = "";
  CHARACTERS.forEach((c, i) => {
    const card = document.createElement("button");
    card.className = "char-card" + (i === 0 ? " sel" : "");
    card.style.setProperty("--acc", c.accent);
    const sig = (c.techniques.find((t) => t.domain) || c.techniques.find((t) => t.ult) || c.techniques[0]).name;
    card.innerHTML = `<div class="sticker"><div class="art-wrap"><div class="glyph">${c.initial}</div>
      <img class="art" alt="${c.name}" src="${c.art}" /><span class="grade">${c.grade || ""}</span></div>
      <div class="label"><span class="cname">${c.name.split(" ")[0]}</span><span class="ctitle">${c.title}</span>
      <span class="cmeta"><i>${c.techniques.length} techniques</i><i class="dot">·</i><i>${sig}</i></span></div></div>`;
    const img = card.querySelector(".art"); img.addEventListener("error", () => (img.style.display = "none"));
    card.onclick = () => { selectChar(c, card); };
    els.charGrid.appendChild(card);
  });
  els.menu.style.setProperty("--acc", CHARACTERS[0].accent);
}
function selectChar(c, card) {
  state.char = c; audio.play("ui");
  [...els.charGrid.children].forEach((n) => n.classList.remove("sel")); card.classList.add("sel");
  els.menu.style.setProperty("--acc", c.accent);   // flood the menu with this sorcerer's cursed energy
}
function buildHelp() {
  const rows = [
    ["🤚", "Form hand signs", "Hold a sign in front of the camera to lock it in, then relax and form the next — like weaving jutsu signs."],
    ["✋✊☝️✌️", "The signs", "Open palm · fist · one finger · two fingers. Two-hand: 👐 both palms, 🙏 hands clasped."],
    ["👏👆", "Release the curse", "Weaving primes a technique — then activate it: clap your hands for two-hand finishers and domains, or point one finger to fire projectiles. No release, no cast."],
    ["🧠", "Technique Trial", "A technique's sign chain flashes, then hides. Recall it, perform it in order, and release it in time. One wrong move ends the run."],
    ["🥷", "Training", "Free practice — weave any technique's signs, then clap or point to unleash it."],
    ["⚔️", "Vs Friend", "Cross-play duel: weave a technique and release it to land it on your rival."],
    ["👆", "No camera?", "Tap the sign keys at the bottom, then tap the glowing release button — same flow, works anywhere."],
  ];
  els.helpBody.innerHTML = rows.map(([g, t, d]) => `<div class="help-row"><div class="g">${g}</div><div><b>${t}</b><p>${d}</p></div></div>`).join("");
}
function buildPalette() {
  els.palette.innerHTML = "";
  for (const s of SIGN_KEYS) {
    const b = document.createElement("button");
    b.className = "pkey"; b.dataset.sign = s; b.textContent = signOf(s).emoji; b.title = signOf(s).label;
    b.onclick = () => inputSign(s);
    els.palette.appendChild(b);
  }
}

/* ---------- camera / sizing ---------- */
async function ensureCamera() {
  if (stream) return stream;
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  els.video.srcObject = stream; await els.video.play().catch(() => {});
  return stream;
}
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  els.fx.width = Math.round(els.fx.clientWidth * dpr); els.fx.height = Math.round(els.fx.clientHeight * dpr);
  bloomA.width = Math.max(1, els.fx.width >> 2); bloomA.height = Math.max(1, els.fx.height >> 2);
  bloomB.width = Math.max(1, els.fx.width >> 3); bloomB.height = Math.max(1, els.fx.height >> 3);
}
window.addEventListener("resize", resize);

/* ---------- stage ---------- */
async function enterStage(mode) {
  try { await ensureCamera(); } catch (e) { return toast("Camera permission needed 📷"); }
  state.mode = mode; state.over = false; state.lock = 0; state.buf = []; state.combo = 0; state.score = 0; state.selfHp = 100; state.oppHp = 100;
  particles.clear(); effects.fx.length = 0; clearPrimed();
  els.stage.style.setProperty("--acc", state.char.accent);
  probeClips(state.char);
  els.menu.classList.add("hidden"); els.stage.classList.remove("hidden");
  els.gameover.classList.add("hidden");
  els.vsBars.classList.toggle("hidden", mode !== "versus");
  els.oppVideo.classList.toggle("hidden", mode !== "versus");
  els.modeName.textContent = mode === "trial" ? "TRIAL" : mode === "versus" ? "DUEL" : "TRAINING";
  els.best.textContent = state.best; els.rightLbl.textContent = mode === "trial" ? "BEST" : "";
  els.score.parentElement.style.visibility = mode === "trial" ? "visible" : "hidden";
  resize();
  if (mode === "trial") { state.round = 0; state.score = 0; els.score.textContent = "0"; els.scroll.classList.remove("book"); nextRound(); }
  else { buildBook(); els.scroll.classList.add("book"); els.techName.textContent = mode === "versus" ? "WEAVE A TECHNIQUE" : "FREE PRACTICE"; els.tLabel.innerHTML = '<span class="buf" id="buf"></span>'; els.timeBar.parentElement.style.visibility = "hidden"; }
  if (mode === "trial") els.timeBar.parentElement.style.visibility = "visible";
  if (mode !== "versus") hint(mode === "trial" ? "Memorise the signs… then perform them!" : "Form any technique's signs", 2600);
  if (!state.running) { state.running = true; requestAnimationFrame(loop); }
}
function leaveStage() { state.mode = "menu"; if (versus) { versus.close(); versus = null; } els.stage.classList.add("hidden"); els.menu.classList.remove("hidden"); }

/* ---------- trial ---------- */
function nextRound() {
  clearPrimed();
  const techs = state.char.techniques;
  state.target = techs[(Math.random() * techs.length) | 0];
  state.idx = 0; state.round++;
  state.roundTime = Math.max(3.4, 7.5 - state.round * 0.25);
  state.timeLeft = state.roundTime;
  state.studyLeft = Math.max(0.5, 2.0 - state.round * 0.13);
  state.hideSigns = false;
  els.techName.textContent = state.target.name;
  els.tLabel.textContent = "PERFORM";
  els.seqRow.dataset.seq = state.target.seq.join(" ");
  renderTrialSeq();
}
function renderTrialSeq() {
  const t = state.target; els.seqRow.innerHTML = "";
  t.seq.forEach((s, i) => {
    const tile = document.createElement("div"); tile.className = "tile";
    if (i < state.idx) { tile.classList.add("done"); tile.textContent = signOf(s).emoji; }
    else { if (i === state.idx) tile.classList.add("cur"); tile.innerHTML = state.hideSigns ? '<span class="qm">?</span>' : signOf(s).emoji; }
    els.seqRow.appendChild(tile);
  });
}
function trialInput(sign) {
  if (state.over || state.lock > 0) return;
  if (sign === state.target.seq[state.idx]) {
    state.idx++; audio.play("ui"); renderTrialSeq();
    if (state.idx >= state.target.seq.length) prime(state.target);   // now clap / point to release
  } else { trialFail("WRONG SIGN"); }
}
function trialSuccess() {
  const t = state.target;
  castTech(t, false);
  const gain = Math.round((80 + t.seq.length * 30) * (1 + state.combo * 0.25));
  state.score += gain; state.combo++;
  els.score.textContent = state.score;
  if (state.score > state.best) { state.best = state.score; localStorage.setItem("jjkw_best", state.best); els.best.textContent = state.best; }
  showCombo(); showStatus(state.timeLeft > state.roundTime * 0.6 ? "PERFECT" : "NICE", state.timeLeft > state.roundTime * 0.6 ? "perfect" : "good");
  state.lock = 0.7; state.pendingNext = true;
}
function trialFail(reason) {
  if (state.over) return;
  state.over = true; clearPrimed(); audio.play("hit"); effects.punchScreen(16, "#ff2436");
  const tiles = els.seqRow.children; if (tiles[state.idx]) tiles[state.idx].classList.add("bad");
  showStatus("MISS", "bad");
  setTimeout(() => {
    els.goTitle.textContent = reason === "TOO SLOW" ? "TOO SLOW" : "WRONG SIGN";
    els.goScore.textContent = state.score; els.goBest.textContent = state.best;
    els.goMsg.textContent = `You wove ${state.round - 1} technique${state.round - 1 === 1 ? "" : "s"}.`;
    els.gameover.classList.remove("hidden");
  }, 700);
}

/* ---------- training / versus (free weave) ---------- */
function buildBook() {
  els.seqRow.innerHTML = "";
  for (const t of state.char.techniques) {
    const row = document.createElement("div"); row.className = "chip"; row.dataset.id = t.id;
    row.innerHTML = `<span class="cn">${t.short}</span><span class="cs">${t.seq.map((s) => `<i>${signOf(s).emoji}</i>`).join("")}</span>`;
    els.seqRow.appendChild(row);
  }
}
function freeInput(sign) {
  state.buf.push(sign); if (state.buf.length > state.maxLen) state.buf.shift();
  const buf = $("#buf"); if (buf) buf.textContent = state.buf.map((s) => signOf(s).emoji).join(" ");
  for (const t of state.char.techniques) {
    const n = t.seq.length;
    if (state.buf.length >= n && t.seq.every((s, i) => state.buf[state.buf.length - n + i] === s)) {
      state.buf = []; if (buf) buf.textContent = "";
      prime(t);                              // weaving done — clap / point to release
      break;
    }
  }
}

/* ---------- unified input ---------- */
function inputSign(sign) {
  if (state.primed) return;                 // sequence done — waiting on a release gesture
  // light the palette key
  const key = els.palette.querySelector(`.pkey[data-sign="${sign}"]`); if (key) { key.classList.add("lit"); setTimeout(() => key.classList.remove("lit"), 200); }
  // juice: a quick energy pop where the hand is (or centre)
  const px = state.aimPos ? state.aimPos.x : els.fx.width / 2, py = state.aimPos ? state.aimPos.y : els.fx.height * 0.6;
  particles.ring(px, py, state.char.palette.glow, 1.2, 16, 5);
  particles.burst(px, py, state.char.palette.a, 1.1, 8, 6, "spark");
  effects.punchScreen(4);
  if (state.mode === "trial") trialInput(sign);
  else freeInput(sign);
}

/* ---------- prime → release (clap / point to activate) ---------- */
function releaseOf(tech) { const last = tech.seq[tech.seq.length - 1]; return (last === "double" || last === "pray" || tech.domain) ? "clap" : "point"; }
function prime(tech) {
  state.primed = tech; state.release = releaseOf(tech);
  const px = state.aimPos ? state.aimPos.x : els.fx.width / 2, py = state.aimPos ? state.aimPos.y : els.fx.height * 0.46;
  particles.implode(px, py, state.char.palette.glow, 1.3, 28, 190);   // energy gathers, ready to fire
  particles.aura(px, py, state.char.palette.a, 1.2, 8);
  effects.punchScreen(5, state.char.accent);
  audio.play("ui");
  const clap = state.release === "clap";
  els.castPrompt.dataset.type = state.release;
  els.castPrompt.querySelector(".cp-ico").textContent = clap ? "👏" : "👆";
  els.castPrompt.querySelector(".cp-act").textContent = clap ? "CLAP" : "POINT";
  els.castPrompt.querySelector(".cp-name").textContent = tech.name;
  els.castPrompt.classList.add("show");
  els.releaseBtn.textContent = clap ? "👏" : "👆";
  els.releaseBtn.classList.add("show");
  els.palette.classList.add("dim");
}
function clearPrimed() {
  state.primed = null; state.release = null;
  els.castPrompt.classList.remove("show"); els.releaseBtn.classList.remove("show"); els.palette.classList.remove("dim");
}
function tryRelease(type) {
  if (!state.primed || state.over) return;
  const want = state.release, tech = state.primed;
  if (type !== want) {                       // wrong activation — no cast
    audio.play("hit"); effects.punchScreen(8, "#ff2436"); showStatus("WRONG!", "bad");
    clearPrimed();
    if (state.mode === "trial") trialFail(want === "clap" ? "NEEDED A CLAP" : "NEEDED A POINT");
    return;
  }
  clearPrimed();
  if (state.mode === "trial") { trialSuccess(); }
  else {
    const chip = els.seqRow.querySelector(`.chip[data-id="${tech.id}"]`);
    if (chip) { chip.classList.add("lit"); setTimeout(() => chip.classList.remove("lit"), 500); }
    castTech(tech, state.mode === "versus");
  }
}

/* ---------- casting / vfx ---------- */
function castTech(tech, send) {
  const W = els.fx.width, H = els.fx.height, char = state.char;
  const path = clipPath(char.id, tech.id);
  if (clipOK[path]) { playClip(path); effects.punchScreen(tech.domain ? 26 : tech.ult ? 18 : 10, char.accent); }
  else effects.trigger(tech.kind, { x: W / 2, y: H * 0.46, aim: -Math.PI / 2, palette: char.palette, W, H, ...tech });
  audio.play(tech.sfx || "blue");
  flashTech(tech.short, char.accent);
  if (tech.ult || tech.domain) showCutin(tech, char);
  if (tech.domain) showBanner("DOMAIN EXPANSION");
  if (send && versus) versus.send({ type: "attack", char: char.id, tech: serialize(tech) });
}
/* ---------- generated VFX clips (Higgsfield etc.) ---------- */
const clipPool = [], clipOK = {}, probed = new Set();
function clipPath(charId, techId) { return `assets/vfx/${charId}_${techId}.webm`; }
function setupClips() { for (let i = 0; i < 2; i++) { const v = document.createElement("video"); v.className = "vfxclip"; v.muted = true; v.playsInline = true; v.preload = "auto"; els.stage.appendChild(v); clipPool.push(v); } }
function probeClips(char) {
  for (const t of char.techniques) {
    const path = clipPath(char.id, t.id);
    if (probed.has(path)) continue; probed.add(path);
    const pv = document.createElement("video"); pv.preload = "metadata"; pv.muted = true;
    pv.onloadedmetadata = () => { clipOK[path] = true; };
    pv.onerror = () => { clipOK[path] = false; };
    pv.src = path;
  }
}
function playClip(path) {
  const v = clipPool.find((x) => x.paused || x.ended || !x.classList.contains("show")) || clipPool[0];
  try { v.src = path; v.currentTime = 0; } catch (e) {}
  v.classList.add("show");
  const hide = () => { v.classList.remove("show"); v.removeEventListener("ended", hide); };
  v.addEventListener("ended", hide);
  v.play().catch(hide);
}
function serialize(t) { return { id: t.id, kind: t.kind, short: t.short, name: t.name, dmg: t.dmg, style: t.style, sub: t.sub, warm: t.warm, water: t.water, barrage: t.barrage, big: t.big }; }
function showCutin(tech, char) {
  els.cutin.style.setProperty("--acc", char.accent);
  els.cutinInit.textContent = char.initial; els.cutinName.textContent = tech.name;
  els.cutin.classList.remove("go"); void els.cutin.offsetWidth; els.cutin.classList.add("go");
}
function flashTech(text, color) { els.techFlash.textContent = text; els.techFlash.style.color = "#fff"; els.techFlash.style.textShadow = `0 0 26px ${color}`; els.techFlash.classList.remove("go"); void els.techFlash.offsetWidth; els.techFlash.classList.add("go"); }
function showBanner(text) { els.banner.textContent = text; els.banner.classList.remove("go"); void els.banner.offsetWidth; els.banner.classList.add("go"); }
function showStatus(text, cls) { els.statusTag.textContent = text; els.statusTag.className = "status-tag " + cls; void els.statusTag.offsetWidth; els.statusTag.classList.add("go"); }
function showCombo() { if (state.combo >= 2) { els.combo.innerHTML = `<b>${state.combo}</b> CHAIN`; els.combo.classList.add("show"); } }
function hint(text) { toast(text); }

/* ---------- loop ---------- */
function makeMap() {
  const vw = els.video.videoWidth || 1280, vh = els.video.videoHeight || 720, W = els.fx.width, H = els.fx.height;
  const scale = Math.max(W / vw, H / vh), dw = vw * scale, dh = vh * scale, dx = (W - dw) / 2, dy = (H - dh) / 2;
  return (p) => ({ x: dx + (state.mirror ? 1 - p.x : p.x) * dw, y: dy + p.y * dh });
}
function loop(now) {
  if (!state.running) return;
  const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
  const W = els.fx.width, H = els.fx.height;

  let g = { hands: [], sign: null, progress: 0, commit: null, pos: null };
  if (tracker.mode === "hands" && els.video.readyState >= 2) g = gestures.process(tracker.detect(els.video, now), makeMap(), now);
  if (g.pos) state.aimPos = g.pos;
  if (g.commit) inputSign(g.commit);
  if (state.primed) { if (g.clap) tryRelease("clap"); else if (g.point) tryRelease("point"); }

  // detected sign indicator
  if (g.sign) { els.signNow.classList.add("show"); els.signNow.style.setProperty("--p", g.progress); els.signNowGlyph.textContent = signOf(g.sign).emoji; }
  else els.signNow.classList.remove("show");

  // trial timing + memory hide
  if (state.mode === "trial" && !state.over) {
    if (state.lock > 0) { state.lock -= dt; if (state.lock <= 0 && state.pendingNext) { state.pendingNext = false; nextRound(); } }
    else {
      if (!state.hideSigns) { state.studyLeft -= dt; if (state.studyLeft <= 0) { state.hideSigns = true; renderTrialSeq(); } }
      state.timeLeft -= dt; els.timeBar.style.width = Math.max(0, state.timeLeft / state.roundTime) * 100 + "%";
      if (state.timeLeft <= 0) trialFail("TOO SLOW");
    }
  }

  for (const h of g.hands) emitHandFlame(h);
  particles.update(dt); effects.update(dt);

  const sh = effects.shake, ox = sh ? (Math.random() * 2 - 1) * sh : 0, oy = sh ? (Math.random() * 2 - 1) * sh : 0;
  els.video.style.transform = `${state.mirror ? "scaleX(-1) " : ""}translate(${state.mirror ? -ox : ox}px,${oy}px) scale(1.04)`;

  ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.translate(ox, oy);
  effects.renderUnder(ctx, W, H);
  drawHands(ctx, g.hands);
  particles.render(ctx); effects.render(ctx, W, H);
  ctx.restore();

  // bloom: downsample the scene twice, then add the small buffers back upscaled
  // (bilinear = soft blur) and additive — a luminous halo over a crisp core.
  if (bloomA.width > 1) {
    bctxA.clearRect(0, 0, bloomA.width, bloomA.height); bctxA.drawImage(els.fx, 0, 0, bloomA.width, bloomA.height);
    bctxB.clearRect(0, 0, bloomB.width, bloomB.height); bctxB.drawImage(bloomA, 0, 0, bloomB.width, bloomB.height);
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = 0.62; ctx.drawImage(bloomB, 0, 0, W, H);
    ctx.globalAlpha = 0.42; ctx.drawImage(bloomA, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  fpsN++; fpsT += dt; if (fpsT >= 0.5) { els.fps.textContent = Math.round(fpsN / fpsT) + " fps"; fpsN = 0; fpsT = 0; }
  requestAnimationFrame(loop);
}
// MediaPipe hand skeleton (bones between the 21 landmarks)
const HAND_BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const TIPS = [4, 8, 12, 16, 20];
function emitHandFlame(h) {
  const pal = state.char.palette;
  for (const tip of TIPS) particles.handFlame(h.px[tip].x, h.px[tip].y, pal.a, pal.glow, 1);
  particles.handFlame(h.center.x, h.center.y, pal.a, pal.glow, 2);
}
function drawHands(ctx, hands) {
  if (!hands.length) return;
  const pal = state.char.palette;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const h of hands) {
    const px = h.px, lw = Math.max(2, h.palmW * 0.1);
    // faint palm aura (the flame carries the rest)
    const r = h.palmW * 1.2, grd = ctx.createRadialGradient(h.center.x, h.center.y, 0, h.center.x, h.center.y, r);
    grd.addColorStop(0, pal.glow + "55"); grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(h.center.x, h.center.y, r, 0, TAU); ctx.fill();
    // skeleton bones — energy glow pass, then a bright core
    ctx.globalAlpha = 0.45; ctx.strokeStyle = pal.a; ctx.lineWidth = lw * 2.2;
    ctx.beginPath(); for (const [a, b] of HAND_BONES) { ctx.moveTo(px[a].x, px[a].y); ctx.lineTo(px[b].x, px[b].y); } ctx.stroke();
    ctx.globalAlpha = 0.92; ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, lw * 0.55);
    ctx.beginPath(); for (const [a, b] of HAND_BONES) { ctx.moveTo(px[a].x, px[a].y); ctx.lineTo(px[b].x, px[b].y); } ctx.stroke();
    // joints — glow + white core (fingertips a touch larger)
    for (let i = 0; i < 21; i++) {
      const jr = (TIPS.includes(i) ? lw * 0.95 : lw * 0.6);
      ctx.globalAlpha = 0.55; ctx.fillStyle = pal.glow; ctx.beginPath(); ctx.arc(px[i].x, px[i].y, jr * 1.9, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px[i].x, px[i].y, jr, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1; ctx.restore();
}

/* ---------- versus ---------- */
function receiveAttack(d) {
  const oc = getCharacter(d.char), m = d.tech, W = els.fx.width, H = els.fx.height;
  const path = m.id ? clipPath(d.char, m.id) : null;
  if (path && clipOK[path]) playClip(path);
  else effects.trigger(m.kind, { x: W / 2, y: H * 0.3, aim: Math.PI / 2, palette: oc.palette, W, H, incoming: true, ...m });
  audio.play("hit"); effects.punchScreen(14, "#ff2436");
  state.selfHp = Math.max(0, state.selfHp - (m.dmg || 0)); updateVsHp();
  versus?.send({ type: "hp", hp: state.selfHp });
  if (state.selfHp <= 0) endDuel(false);
}
function updateVsHp() { els.p1Hp.style.width = state.selfHp + "%"; els.p2Hp.style.width = state.oppHp + "%"; }
function endDuel(win) {
  if (state.over) return; state.over = true;
  showBanner(win ? "WIN" : "K.O."); flashTech(win ? "VICTORY" : "DEFEAT", win ? state.char.accent : "#ff2436");
  if (win) effects.trigger("domain", { x: els.fx.width / 2, y: els.fx.height / 2, palette: state.char.palette, W: els.fx.width, H: els.fx.height, style: "void" });
}
function newVersus() {
  return new Versus({
    onStatus: (m) => (els.lobbyStatus.textContent = m),
    onConnected: () => { versus.send({ type: "char", id: state.char.id }); els.lobby.classList.add("hidden"); enterStage("versus"); },
    onData: (d) => {
      if (d.type === "char") { state.oppChar = d.id; els.p2Name.textContent = getCharacter(d.id).name.split(" ")[0]; probeClips(getCharacter(d.id)); }
      else if (d.type === "attack") receiveAttack(d);
      else if (d.type === "hp") { state.oppHp = d.hp; updateVsHp(); if (d.hp <= 0) endDuel(true); }
    },
    onRemoteStream: (rs) => { els.oppVideo.srcObject = rs; els.oppVideo.play().catch(() => {}); },
    onClose: () => { if (state.mode === "versus") toast("Opponent disconnected"); },
  });
}

/* ---------- capture / toast ---------- */
async function capture() {
  audio.play("shutter");
  const f = document.createElement("div"); f.style.cssText = "position:absolute;inset:0;background:#fff;z-index:9;pointer-events:none"; els.stage.appendChild(f);
  f.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 220 }).onfinish = () => f.remove();
  const url = composeShot({ video: els.video, fxCanvas: els.fx, character: state.char, techName: state.target?.name || "", mirror: state.mirror, artImg: artCache[state.char.id] });
  const img = new Image(); img.src = url; img.className = "shot"; img.onclick = () => postShot(url);
  els.gallery.prepend(img); while (els.gallery.children.length > 4) els.gallery.lastChild.remove();
  const r = await postShot(url); if (r === "downloaded") toast("Saved ⬇"); else if (r === "shared") toast("Shared ⚡");
}
let toastEl; function toast(msg) {
  if (!toastEl) { toastEl = document.createElement("div"); toastEl.style.cssText = "position:fixed;left:50%;bottom:210px;transform:translateX(-50%);z-index:60;background:rgba(8,9,14,.9);border:1px solid rgba(255,255,255,.16);padding:8px 16px;border-radius:8px;font-weight:600;transition:.3s;opacity:0;pointer-events:none"; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.style.opacity = "1"; clearTimeout(toastEl._t); toastEl._t = setTimeout(() => (toastEl.style.opacity = "0"), 2000);
}

/* ---------- UI ---------- */
function wireUI() {
  document.body.addEventListener("pointerdown", () => audio.unlockAudio(), { once: true });
  document.querySelectorAll(".mode-btn[data-mode]").forEach((b) => {
    b.onclick = () => {
      audio.play("ui"); const mode = b.dataset.mode;
      if (mode === "versus") ensureCamera().then(() => { versus = newVersus(); openLobby(); }).catch(() => toast("Camera permission needed 📷"));
      else enterStage(mode);
    };
  });
  els.howToBtn.onclick = () => els.help.classList.remove("hidden");
  els.helpClose.onclick = () => els.help.classList.add("hidden");
  els.backBtn.onclick = leaveStage;
  els.releaseBtn.onclick = () => { if (state.primed) tryRelease(state.release); };
  els.captureBtn.onclick = capture;
  els.mirrorBtn.onclick = () => { state.mirror = !state.mirror; };
  els.soundBtn.onclick = () => { audio.setMuted(!audio.muted); els.soundBtn.textContent = audio.muted ? "🔇" : "🔊"; };
  els.retryBtn.onclick = () => { els.gameover.classList.add("hidden"); enterStage("trial"); };
  els.goMenuBtn.onclick = () => { els.gameover.classList.add("hidden"); leaveStage(); };
  els.createRoom.onclick = async () => { els.lobbyStatus.textContent = "Creating room…"; try { const code = await versus.host(stream); els.codeText.textContent = code; els.lobbyCode.classList.remove("hidden"); } catch (e) { els.lobbyStatus.textContent = "Could not create room."; } };
  els.joinRoom.onclick = async () => { const code = els.roomInput.value.trim().toUpperCase(); if (code.length < 4) return (els.lobbyStatus.textContent = "Enter the room code."); els.lobbyStatus.textContent = "Joining…"; try { await versus.join(code, stream); } catch (e) { els.lobbyStatus.textContent = "Could not join."; } };
  els.copyCode.onclick = () => { navigator.clipboard?.writeText(els.codeText.textContent); toast("Code copied"); };
  els.lobbyClose.onclick = () => { els.lobby.classList.add("hidden"); if (versus) { versus.close(); versus = null; } };
}
function openLobby() { els.lobby.classList.remove("hidden"); els.lobbyCode.classList.add("hidden"); els.lobbyStatus.textContent = ""; els.roomInput.value = ""; }

boot();
