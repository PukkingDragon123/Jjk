// JUJUTSU WEB — camera + hand-sign casting + arena-fighter HUD + campaign + versus.
import { CHARACTERS, getCharacter, skillById, SLOT_SIGNS } from "./characters.js";
import * as loadout from "./loadout.js";
import { signOf } from "./signs.js";
import { Tracker } from "./tracking.js";
import { GestureEngine } from "./gestures.js";
import { ParticleSystem } from "./vfx/particles.js";
import { EffectManager } from "./vfx/techniques.js";
import { Versus } from "./multiplayer.js";
import { composeShot, postShot } from "./capture.js";
import * as audio from "./audio.js";
import * as rank from "./rank.js";
import { STAGES, Enemy, loadProgress, saveProgress } from "./campaign.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[9,10],[10,11],[11,12],
  [13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17],
];

const els = {
  boot: $("#boot"), bootBar: $("#bootBar"), bootMsg: $("#bootMsg"),
  menu: $("#menu"), charGrid: $("#charGrid"), rankBadge: $("#rankBadge"),
  stage: $("#stage"), video: $("#video"), fx: $("#fx"),
  p1Hp: $("#p1Hp"), p2Hp: $("#p2Hp"), p1Name: $("#p1Name"), p2Name: $("#p2Name"),
  p1Init: $("#p1Init"), p2Init: $("#p2Init"), p1Avatar: $("#p1Avatar"), p2Avatar: $("#p2Avatar"),
  p2wrap: $("#p2wrap"), specialFill: $("#specialFill"), burstPips: $("#burstPips"),
  combo: $("#combo"), comboN: $("#comboN"), statusTag: $("#statusTag"), banner: $("#banner"),
  cutin: $("#cutin"), cutinInit: $("#cutinInit"), cutinName: $("#cutinName"),
  oppVideo: $("#oppVideo"), fps: $("#fps"),
  hint: $("#hint"), techFlash: $("#techFlash"),
  qte: $("#qte"), qteSign: $("#qteSign"), qteLabel: $("#qte .qte-label"),
  spellbook: $("#spellbook"), gallery: $("#gallery"),
  lobby: $("#lobby"), createRoom: $("#createRoom"), joinRoom: $("#joinRoom"), roomInput: $("#roomInput"),
  lobbyCode: $("#lobbyCode"), codeText: $("#codeText"), copyCode: $("#copyCode"), lobbyStatus: $("#lobbyStatus"), lobbyClose: $("#lobbyClose"),
  queue: $("#queue"), queueStatus: $("#queueStatus"), queueRank: $("#queueRank"), queueClose: $("#queueClose"),
  story: $("#story"), storyGlyph: $("#storyGlyph"), storyTitle: $("#storyTitle"), storyText: $("#storyText"), storyGo: $("#storyGo"),
  help: $("#help"), helpBody: $("#helpBody"), helpClose: $("#helpClose"), howToBtn: $("#howToBtn"),
  cloakBtn: $("#cloakBtn"), captureBtn: $("#captureBtn"), soundBtn: $("#soundBtn"), mirrorBtn: $("#mirrorBtn"), backBtn: $("#backBtn"),
  customize: $("#customize"), customizeBtn: $("#customizeBtn"), czTabs: $("#czTabs"), czCoins: $("#czCoins"), czSlots: $("#czSlots"), czPool: $("#czPool"), czClose: $("#czClose"),
};

const ctx = els.fx.getContext("2d");
const tracker = new Tracker();
const gestures = new GestureEngine();
const particles = new ParticleSystem(1400);
const effects = new EffectManager(particles);

const state = {
  mode: "menu", char: CHARACTERS[0], mirror: true, cloak: true,
  ce: 1, surge: 0, running: false, matchOver: false, invuln: 0, cool: {},
  qte: null, curSign: null, swiped: false,
  selfHp: 100, oppHp: 100, oppChar: "gojo", ranked: false,
  aimPos: null, aim: -Math.PI / 2,
  history: [], recent: [], clock: 0, combo: 0, comboT: 0,
  stageIndex: 0, enemy: null, enemyAnim: { lunge: 0 },
  book: [], czChar: "gojo", czSlot: 0,
  lastTechName: "", gallery: [],
};
function rebuildBook() { state.book = loadout.activeBook(state.char); }
const bookBySign = (sign) => state.book.find((m) => m.sign === sign);
let stream = null, versus = null, spellSlots = [];
const artCache = {};
let lastFrame = performance.now(), fpsT = 0, fpsN = 0;

/* ---------- boot ---------- */
function loadArt() {
  for (const c of CHARACTERS) {
    if (!c.art) continue;
    const img = new Image();
    img.onload = () => { artCache[c.id] = img; setFighters(); };
    img.src = c.art;
  }
}
function renderRankBadge() {
  const p = rank.load(), t = rank.tierFor(p.points), nx = rank.nextTier(p.points);
  const prog = nx ? Math.round(((p.points - t.min) / (nx.min - t.min)) * 100) : 100;
  els.rankBadge.style.setProperty("--accent", t.color);
  els.rankBadge.innerHTML = `<div class="rg" style="color:${t.color}">${t.tag}</div>
    <div class="rinfo"><span class="rname">${t.name}</span><span class="rpts">${p.points} CE · ${p.wins}W/${p.losses}L</span>
    <span class="rprog"><span style="width:${prog}%;background:${t.color}"></span></span></div>`;
}
async function boot() {
  loadArt(); renderRankBadge(); buildCharGrid(); buildHelp(); wireUI();
  let p = 0;
  const tick = setInterval(() => { p = Math.min(0.85, p + 0.05); els.bootBar.style.width = p * 100 + "%"; }, 120);
  const mode = await tracker.init((v, msg) => { p = Math.max(p, v); els.bootBar.style.width = p * 100 + "%"; if (msg) els.bootMsg.textContent = msg; });
  clearInterval(tick); els.bootBar.style.width = "100%";
  els.bootMsg.textContent = mode === "hands" ? "cursed sight online." : "tap-the-spell mode (no camera AI).";
  setTimeout(() => { els.boot.classList.add("hidden"); els.menu.classList.remove("hidden"); }, 450);
}

/* ---------- menu ---------- */
function buildCharGrid() {
  els.charGrid.innerHTML = "";
  CHARACTERS.forEach((c, i) => {
    const card = document.createElement("button");
    card.className = "char-card" + (i === 0 ? " sel" : "");
    card.style.setProperty("--accent", c.accent);
    card.innerHTML = `<div class="sticker"><div class="art-wrap"><div class="glyph">${c.initial}</div>
      <img class="art" alt="${c.name}" src="${c.art}" /><span class="cgrade">${c.grade}</span></div>
      <div class="label"><span class="cname">${c.name}</span><span class="ctitle">${c.title}</span>
      <span class="csig">★ ${c.ultimate.short}</span></div></div>`;
    const img = card.querySelector(".art");
    img.addEventListener("error", () => { img.style.display = "none"; });
    card.onclick = () => {
      state.char = c; audio.play("ui");
      [...els.charGrid.children].forEach((n) => n.classList.remove("sel"));
      card.classList.add("sel");
    };
    els.charGrid.appendChild(card);
  });
}
function buildHelp() {
  const rows = [
    ["🤚", "Cast with hand signs", "Each spell shows its sign in the spellbook. Hold the sign briefly to cast — detection is smoothed for reliability."],
    ["✋✊", "Basics", "Open palm / fist / one finger / two fingers cast your three equipped skills. They cost cursed energy (the SPECIAL gauge)."],
    ["👐", "Ultimate", "Open BOTH hands together for your ultimate — spends a chunk of the SPECIAL gauge."],
    ["🙏", "Domain", "Clasp BOTH hands when your BURST pips are full to expand your Domain."],
    ["⚔️", "Counter", "When a curse winds up, a ring shows a sign — make it (or tap it) in time to parry + counter-hit."],
    ["↔", "Dodge", "Swipe your hand sideways to dodge with brief invulnerability. Curses move and strike from either side."],
    ["🔗", "Combos", "Land three basic skills in a row for your character's combo finisher."],
    ["🛠️", "Loadout", "Equip 3 skills and upgrade them with cursed coins (earned by winning)."],
    ["👆", "No camera AI?", "Tap a spell card to cast and tap the prompt to counter — works on any device."],
  ];
  els.helpBody.innerHTML = rows.map(([g, t, d]) => `<div class="help-row"><div class="g">${g}</div><div><b>${t}</b><p>${d}</p></div></div>`).join("");
}

/* ---------- spellbook ---------- */
function buildSpellbook() {
  els.spellbook.innerHTML = ""; spellSlots = [];
  for (const m of state.book) {
    const sl = document.createElement("button");
    sl.className = "spell"; sl.style.setProperty("--accent", state.char.accent);
    const tag = m.tier === "ultimate" ? "ULT" : m.tier === "domain" ? "DOM" : m.tier === "utility" ? "DEF" : "";
    const lv = (m.lvl || 1) > 1 ? `<span class="lv">L${m.lvl}</span>` : "";
    sl.innerHTML = `<span class="cd"></span>${tag ? `<span class="tag">${tag}</span>` : ""}${lv}<span class="sgn">${signOf(m.sign).emoji}</span>
      <span class="snm">${m.short}</span><span class="ring"><span></span></span>`;
    sl.onclick = () => cast(m, { tap: true });
    els.spellbook.appendChild(sl);
    spellSlots.push({ el: sl, move: m, ring: sl.querySelector(".ring span"), cd: sl.querySelector(".cd") });
  }
}
function updateSpellbook(activeSign, progress) {
  for (const s of spellSlots) {
    const cd = state.cool[s.move.id];
    const remain = cd ? Math.max(0, cd.until - state.clock) : 0;
    const cooling = remain > 0.02;
    s.cd.style.height = (cooling && cd.total ? (remain / cd.total) * 100 : 0) + "%";
    const lockRes = s.move.tier === "domain" ? state.surge < 1 : (s.move.cost && state.ce < s.move.cost);
    s.el.classList.toggle("locked", !!lockRes || cooling);
    const active = activeSign && s.move.sign === activeSign && !cooling;
    s.el.classList.toggle("active", !!active);
    s.ring.style.width = (active ? progress * 100 : 0) + "%";
  }
}
function flashSlot(id) {
  const s = spellSlots.find((x) => x.move.id === id);
  if (s) { s.el.classList.remove("flash-cast"); void s.el.offsetWidth; s.el.classList.add("flash-cast"); }
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
  els.fx.width = Math.round(els.fx.clientWidth * dpr);
  els.fx.height = Math.round(els.fx.clientHeight * dpr);
}
window.addEventListener("resize", resize);

/* ---------- fighter HUD ---------- */
function setFighters() {
  const c = state.char;
  const img = artCache[c.id];
  if (img) { els.p1Avatar.src = img.src; els.p1Avatar.style.display = "block"; els.p1Init.style.display = "none"; }
  else { els.p1Avatar.style.display = "none"; els.p1Init.style.display = ""; els.p1Init.textContent = c.initial; }
  els.p1Name.textContent = c.name.split(" ")[0];
  if (state.mode === "campaign" && state.enemy) {
    els.p2Init.textContent = state.enemy.s.emoji; els.p2Avatar.style.display = "none"; els.p2Init.style.display = "";
    els.p2Name.textContent = state.enemy.s.name;
  } else if (state.mode === "versus") {
    const oc = getCharacter(state.oppChar);
    els.p2Init.textContent = oc.initial; els.p2Avatar.style.display = "none"; els.p2Init.style.display = "";
    els.p2Name.textContent = oc.name.split(" ")[0];
  }
}
function updateBars() {
  els.p1Hp.style.width = state.selfHp + "%";
  els.specialFill.style.width = state.ce * 100 + "%";
  const lit = Math.round(state.surge * 4);
  [...els.burstPips.children].forEach((p, i) => p.classList.toggle("on", i < lit));
  if (state.mode === "campaign") els.p2Hp.style.width = (state.enemy ? state.enemy.pct * 100 : 0) + "%";
  else els.p2Hp.style.width = state.oppHp + "%";
}
function showStatus(text, cls) {
  els.statusTag.textContent = text; els.statusTag.className = "status-tag " + cls;
  void els.statusTag.offsetWidth; els.statusTag.classList.add("go");
}
function showBanner(text) {
  els.banner.textContent = text; els.banner.classList.remove("go"); void els.banner.offsetWidth; els.banner.classList.add("go");
}
function comboBump(n) {
  els.comboN.textContent = n;
  if (n >= 2) { els.combo.classList.add("show"); els.combo.style.animation = "none"; void els.combo.offsetWidth; els.combo.style.animation = ""; }
}

/* ---------- stage ---------- */
async function enterStage(mode) {
  try { await ensureCamera(); } catch (e) { return toast("Camera permission needed 📷"); }
  state.mode = mode; state.ce = 1; state.surge = 0; state.selfHp = 100; state.oppHp = 100; state.matchOver = false;
  state.invuln = 0; state.recent = []; state.enemyAnim.lunge = 0; state.combo = 0; state.comboT = 0; state.cool = {}; clearQte();
  particles.clear(); effects.fx.length = 0; els.combo.classList.remove("show");
  els.menu.classList.add("hidden"); els.stage.classList.remove("hidden");
  els.p2wrap.classList.toggle("hidden", mode === "solo");
  els.oppVideo.classList.toggle("hidden", mode !== "versus");
  if (!els.burstPips.children.length) els.burstPips.innerHTML = "<i></i><i></i><i></i><i></i>";
  rebuildBook(); buildSpellbook(); resize();
  if (mode === "campaign") setupStage();
  setFighters(); updateBars();
  if (!state.running) { state.running = true; requestAnimationFrame(loop); }
  if (mode === "solo") hint("Form a hand sign to cast — see the spellbook below ⚡", 3000);
  else showBanner("FIGHT!");
}
function leaveStage() {
  state.mode = "menu"; state.ranked = false; state.enemy = null;
  if (versus) { versus.close(); versus = null; }
  els.stage.classList.add("hidden"); els.menu.classList.remove("hidden");
  renderRankBadge();
}

/* ---------- loop ---------- */
function makeMap() {
  const vw = els.video.videoWidth || 1280, vh = els.video.videoHeight || 720;
  const W = els.fx.width, H = els.fx.height;
  const scale = Math.max(W / vw, H / vh), dw = vw * scale, dh = vh * scale, dx = (W - dw) / 2, dy = (H - dh) / 2;
  return (p) => ({ x: dx + (state.mirror ? 1 - p.x : p.x) * dw, y: dy + p.y * dh, z: p.z || 0 });
}
function loop(now) {
  if (!state.running) return;
  const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now; state.clock = now / 1000;
  const W = els.fx.width, H = els.fx.height;

  let g = { hands: [], sign: null, progress: 0, cast: null, pos: null, aim: -Math.PI / 2, swipe: false, swipeDir: null };
  if (tracker.mode === "hands" && els.video.readyState >= 2) g = gestures.process(tracker.detect(els.video, now), makeMap(), now);
  if (g.pos) { state.aimPos = g.pos; state.aim = g.aim; }
  state.curSign = g.sign; state.swiped = g.swipe;

  if (!effects.domainActive) state.ce = Math.min(1, state.ce + dt * 0.16);
  state.surge = Math.min(1, state.surge + dt * 0.04);
  if (state.invuln > 0) state.invuln -= dt;
  if (state.comboT > 0) { state.comboT -= dt; if (state.comboT <= 0) { state.combo = 0; els.combo.classList.remove("show"); } }
  if (g.swipe) dodge();
  if (g.cast) { const m = bookBySign(g.cast); if (m) cast(m, { charged: g.charged }); }

  for (const h of g.hands) {
    if (state.cloak) { if (Math.random() < 0.7) particles.flame(h.center.x, h.center.y, "#5aa8ff", 1.3, 1); }
    else if (Math.random() < 0.5) particles.aura(h.center.x, h.center.y, state.char.palette.glow, 1, 1);
  }
  if (state.mode === "campaign") updateCampaign(dt);

  particles.update(dt); effects.update(dt);

  const sh = effects.shake, ox = sh ? (Math.random() * 2 - 1) * sh : 0, oy = sh ? (Math.random() * 2 - 1) * sh : 0;
  els.video.style.transform = `${state.mirror ? "scaleX(-1) " : ""}translate(${state.mirror ? -ox : ox}px,${oy}px) scale(1.04)`;

  ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.translate(ox, oy);
  effects.renderUnder(ctx, W, H);
  if (state.mode === "campaign") drawCurse(ctx, W, H, now);
  drawAura(ctx, g.hands); drawHandRig(ctx, g.hands);
  particles.render(ctx);
  effects.render(ctx, W, H);
  ctx.restore();

  updateBars();
  updateSpellbook(g.sign, g.progress);
  fpsN++; fpsT += dt; if (fpsT >= 0.5) { els.fps.textContent = Math.round(fpsN / fpsT) + " fps"; fpsN = 0; fpsT = 0; }
  requestAnimationFrame(loop);
}
/* ---------- drawing ---------- */
function drawAura(ctx, hands) {
  if (!hands.length) return;
  const pal = state.char.palette, style = state.char.look?.aura || "glow", t = performance.now() / 1000;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const h of hands) {
    const x = h.center.x, y = h.center.y, r = h.palmW * 1.7;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, pal.glow + "cc"); grd.addColorStop(0.5, pal.a + "55"); grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (style === "rings") { ctx.lineWidth = 2.5; for (let i = 0; i < 2; i++) { ctx.strokeStyle = i ? pal.b : pal.a; ctx.globalAlpha = .55; const rr = r * (.55 + i * .32); ctx.beginPath(); ctx.ellipse(x, y, rr, rr * .42, t * (1.4 + i), 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
    else if (style === "claw") { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(x - r * .6, y + i * 9 - 2); ctx.quadraticCurveTo(x, y + i * 6, x + r * .6, y + i * 11 + 2); ctx.stroke(); } ctx.globalAlpha = 1; }
    else if (style === "spark") { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6; for (let k = 0; k < 3; k++) { ctx.globalAlpha = Math.random() * .6 + .2; let a = Math.random() * TAU, cx = x, cy = y; ctx.beginPath(); ctx.moveTo(cx, cy); for (let j = 0; j < 3; j++) { cx += Math.cos(a) * r * .4; cy += Math.sin(a) * r * .4; a += rnd(-1, 1); ctx.lineTo(cx, cy); } ctx.stroke(); } ctx.globalAlpha = 1; }
  }
  if (style === "ink") { ctx.globalCompositeOperation = "source-over"; for (const h of hands) { ctx.globalAlpha = .5; ctx.fillStyle = "#0c0f22"; ctx.beginPath(); ctx.arc(h.center.x, h.center.y, h.palmW * 1.1, 0, TAU); ctx.fill(); if (Math.random() < .5) particles.aura(h.center.x, h.center.y, pal.b, .8, 1); } ctx.globalAlpha = 1; }
  ctx.restore();
}
function drawCurse(ctx, W, H, now) {
  if (!state.enemy) return;
  const e = state.enemy, s = e.s, t = now / 1000, k = Math.min(W, H) / 720;
  const lunge = state.enemyAnim.lunge > 0 ? state.enemyAnim.lunge / .35 : 0;
  const cx = e.pos.x * W, cy = e.pos.y * H + Math.sin(t * 2) * 6 * k + lunge * 40 * k;
  // telegraph attack zone (cone toward the player hitbox)
  if (e.telegraph > 0) {
    const py = H * 0.86, a = .25 + .35 * Math.abs(Math.sin(now / 70));
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
    const grd = ctx.createLinearGradient(cx, cy, W / 2, py); grd.addColorStop(0, "#ff3b4e"); grd.addColorStop(1, "rgba(255,59,78,0)");
    ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(W / 2 - 120 * k, py); ctx.lineTo(W / 2 + 120 * k, py); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // player hitbox bracket
  if (!state.matchOver) {
    const px = W / 2, py = H * 0.86, hw = 120 * k, hh = 40 * k;
    ctx.save(); ctx.strokeStyle = state.invuln > 0 ? "rgba(55,224,207,.9)" : "rgba(55,224,207,.4)"; ctx.lineWidth = 3;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(px + sx * hw, py + sy * hh - sy * 14); ctx.lineTo(px + sx * hw, py + sy * hh); ctx.lineTo(px + sx * hw - sx * 14, py + sy * hh); ctx.stroke();
    }
    ctx.restore();
  }
  const scale = k * (e.dead ? .5 : 1) * (1 + lunge * .18);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
  ctx.globalCompositeOperation = "lighter";
  const ga = ctx.createRadialGradient(0, 0, 0, 0, 0, 150); ga.addColorStop(0, s.color + "66"); ga.addColorStop(1, "transparent");
  ctx.fillStyle = ga; ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#0c0a12"; ctx.strokeStyle = s.color; ctx.lineWidth = 3;
  ctx.beginPath(); const N = 14, R = 92;
  for (let i = 0; i <= N; i++) { const a = i / N * TAU, r = R * (.78 + .22 * Math.sin(t * 3 + i * 1.7)), x = Math.cos(a) * r, y = Math.sin(a) * r * .92; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const [ex, ey] of [[-34, -12], [30, -18], [-6, 18], [50, 6], [-46, 24]]) {
    ctx.fillStyle = s.color; ctx.beginPath(); ctx.ellipse(ex, ey, 8, 11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#140008"; ctx.beginPath(); ctx.arc(ex, ey + 1, 3, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = "#140008"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-26, 46); ctx.quadraticCurveTo(0, 62 + Math.sin(t * 4) * 6, 26, 46); ctx.stroke();
  ctx.restore();
}
function drawHandRig(ctx, hands) {
  if (!hands.length) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = state.char.palette.glow + "aa";
  for (const h of hands) {
    ctx.lineWidth = Math.max(1.5, h.palmW * .05);
    for (const [a, b] of HAND_CONNECTIONS) { ctx.beginPath(); ctx.moveTo(h.px[a].x, h.px[a].y); ctx.lineTo(h.px[b].x, h.px[b].y); ctx.stroke(); }
    ctx.fillStyle = "#fff";
    for (const tip of [4, 8, 12, 16, 20]) { ctx.beginPath(); ctx.arc(h.px[tip].x, h.px[tip].y, Math.max(2, h.palmW * .06), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

/* ---------- casting ---------- */
function cdFor(move, charged) {
  let cd = move.tier === "ultimate" ? 6 : move.tier === "domain" ? 2 : move.kind === "guard" ? 5 : 0.7;
  return charged ? cd * 1.6 : cd;
}
function cast(move, opts = {}) {
  if (!move) return;
  const W = els.fx.width, H = els.fx.height;
  const pos = state.aimPos || { x: W / 2, y: H * .42 };
  const charged = opts.charged && move.tier !== "domain" && move.kind !== "guard";
  const m = charged ? { ...move, dmg: Math.round((move.dmg || 0) * 1.6), big: true, cost: (move.cost || 0) * 1.4 } : move;
  if (!doCast(m, pos, state.aim, { combo: opts.combo, charged })) return;
  flashSlot(move.id);
  if (!opts.combo && move.tier === "basic") feedCombo();
}
function doCast(move, pos, aim, { incoming = false, fromCharId = null, combo = false, charged = false } = {}) {
  const char = incoming ? getCharacter(fromCharId || state.oppChar) : state.char;
  if (!incoming) {
    const c = state.cool[move.id];
    if (c && c.until - state.clock > 0.02) { hint(move.short + " recharging…"); return false; }
    if (move.tier === "domain") { if (state.surge < 1) { hint("Domain needs a full BURST meter"); return false; } state.surge = 0; }
    else { const cost = move.cost || 0; if (cost && state.ce < cost) { hint("Not enough cursed energy for " + move.short); return false; } state.ce = Math.max(0, state.ce - cost); }
    const cd = cdFor(move, charged); state.cool[move.id] = { until: state.clock + cd, total: cd };
  }
  const W = els.fx.width, H = els.fx.height;
  const bigMove = move.tier === "ultimate" || move.tier === "domain" || combo || charged;
  if (move.kind === "guard") {
    effects.trigger("guard", { x: pos.x, y: pos.y, palette: char.palette, W, H });
    if (!incoming) { state.invuln = Math.max(state.invuln, 2.4); state.lastTechName = move.name; }
    audio.play(move.sfx || "ui"); flashTech(move.short, char.accent); return true;
  }
  effects.trigger(move.kind, { x: pos.x, y: pos.y, aim, palette: char.palette, W, H, incoming, ...move });
  audio.play(move.sfx || "blue"); flashTech((charged ? "CHARGED " : "") + move.short, char.accent);
  if (!incoming && bigMove) showCutin(move, char, charged);
  if (!incoming) {
    state.lastTechName = move.name;
    if (move.dmg) { state.surge = Math.min(1, state.surge + .1); state.combo++; state.comboT = 2.2; comboBump(state.combo); }
    if (move.tier === "domain") { state.invuln = 3.0; showBanner("DOMAIN EXPANSION"); }
    if (state.mode === "campaign" && state.enemy && !state.enemy.dead && move.dmg) {
      effects.trigger("burst", { x: state.enemy.pos.x * W, y: state.enemy.pos.y * H, palette: char.palette, W, H, big: bigMove });
      if (bigMove) showStatus("STAGGERED", "stagger");
      if (state.enemy.damage(move.dmg)) campaignClear();
    }
    if (state.mode === "versus" && versus) versus.send({ type: "attack", char: char.id, move: serialize(move) });
  }
  return true;
}
function showCutin(move, char, charged) {
  els.cutin.style.setProperty("--accent", char.accent);
  els.cutinInit.textContent = char.initial;
  els.cutinName.textContent = (charged ? "CHARGED · " : "") + move.name;
  els.cutin.classList.remove("go"); void els.cutin.offsetWidth; els.cutin.classList.add("go");
}
function feedCombo() {
  state.recent.push(state.clock);
  state.recent = state.recent.filter((t) => state.clock - t < 2.6);
  if (state.recent.length >= 3) { state.recent = []; const f = state.char.comboFinisher; hint("⚡ COMBO · " + f.name); cast(f, { combo: true }); }
}
function serialize(m) { return { kind: m.kind, short: m.short, name: m.name, dmg: m.dmg, style: m.style, sub: m.sub, warm: m.warm, water: m.water, barrage: m.barrage, big: m.big }; }
function flashTech(text, color) {
  els.techFlash.textContent = text; els.techFlash.style.color = "#fff";
  els.techFlash.style.textShadow = `0 0 22px ${color}`;
  els.techFlash.classList.remove("go"); void els.techFlash.offsetWidth; els.techFlash.classList.add("go");
}
let hintTimer;
function hint(text, ms = 1500) { els.hint.textContent = text; els.hint.classList.add("show"); clearTimeout(hintTimer); hintTimer = setTimeout(() => els.hint.classList.remove("show"), ms); }

/* ---------- defense: counter / dodge ---------- */
// Timing skill-check: input lands "perfect" only in the late sweet window.
function startPrompt(type, dir, dur) {
  const need = pick(["fist", "open", "one", "two"]);
  state.qte = { type, need, dir, t: 0, dur, done: false };
  if (type === "counter") { els.qteSign.textContent = signOf(need).emoji; els.qteLabel.textContent = "COUNTER — " + signOf(need).label; }
  else { const dd = dir === "left" ? "right" : "left"; els.qteSign.textContent = dd === "left" ? "←" : "→"; els.qteLabel.textContent = "DODGE!"; }
  els.qte.style.setProperty("--p", 1); els.qte.classList.remove("sweet"); els.qte.classList.add("show");
}
function clearQte() { state.qte = null; if (els.qte) els.qte.classList.remove("show", "sweet"); }
function registerQteInput(kind) {
  const q = state.qte; if (!q || q.done) return;
  if (q.type === "counter" && kind === "swipe") return;
  if (q.type === "dodge" && kind === "sign") return;
  const f = q.t / q.dur;
  const zone = (f >= 0.56 && f <= 0.99) ? "perfect" : f >= 0.3 ? "good" : "early";
  els.qte.classList.remove("show");
  if (q.type === "counter") {
    if (zone === "early") { q.done = "early"; showStatus("MISS", "blocked"); return; }
    q.done = "counter"; counterHit(zone === "perfect");
  } else {
    q.done = "dodge"; doDodge(zone !== "early");
  }
}
function counterHit(perfect) {
  const W = els.fx.width, H = els.fx.height;
  effects.trigger("parry", { x: W / 2, y: H * .42, palette: state.char.palette, W, H });
  effects.punchScreen(16, "#fff"); audio.play("flash");
  state.surge = Math.min(1, state.surge + (perfect ? .3 : .15));
  showStatus(perfect ? "PERFECT" : "COUNTER", "counter"); flashTech("COUNTER", "#fff");
  if (state.enemy && !state.enemy.dead) { effects.trigger("burst", { x: state.enemy.pos.x * W, y: state.enemy.pos.y * H, palette: state.char.palette, W, H, big: perfect }); if (state.enemy.damage(perfect ? 30 : 16)) campaignClear(); }
}
function doDodge(reward) {
  state.invuln = Math.max(state.invuln, .6);
  particles.burst(els.fx.width * .5, els.fx.height * .55, state.char.palette.glow, 1.2, 16, 9, "streak");
  if (reward) state.surge = Math.min(1, state.surge + .1);
  showStatus("BLOCKED", "blocked"); audio.play("ui");
}
function dodge() {
  if (state.qte && !state.qte.done && state.qte.type === "dodge") return registerQteInput("swipe");
  if (state.invuln > .3) return;
  state.invuln = Math.max(state.invuln, .55);
  effects.punchScreen(5); particles.burst(els.fx.width * .5, els.fx.height * .55, state.char.palette.glow, 1.2, 14, 9, "streak");
  audio.play("ui");
}
function updateCampaign(dt) {
  if (state.enemyAnim.lunge > 0) state.enemyAnim.lunge -= dt;
  const q = state.qte;
  if (q && !q.done) {
    q.t += dt; const f = q.t / q.dur;
    els.qte.style.setProperty("--p", Math.max(0, 1 - f));
    els.qte.classList.toggle("sweet", f >= 0.56 && f <= 0.99);
    if (q.type === "counter" && state.curSign === q.need) registerQteInput("sign");
  }
  if (state.matchOver || !state.enemy) return;
  // the curse gathers cursed energy as it winds up (telegraph)
  if (state.enemy.telegraph > 0) particles.implode(state.enemy.pos.x * els.fx.width, state.enemy.pos.y * els.fx.height, state.enemy.s.color, 1.4, 4, 90);
  const ev = state.enemy.update(dt);
  if (ev?.telegraph) startPrompt(ev.telegraph.type, ev.telegraph.dir, ev.telegraph.dur);
  if (ev?.attack) {
    state.enemyAnim.lunge = .35;
    const W = els.fx.width, H = els.fx.height, col = state.enemy.s.color, ex = state.enemy.pos.x * W, ey = state.enemy.pos.y * H;
    const countered = q && q.done === "counter";
    const dodged = (q && q.done === "dodge") || state.invuln > 0;
    clearQte();
    if (countered) return;
    // the cursed spirit's attack flies at the player
    const aim = Math.atan2(H * .82 - ey, W / 2 - ex);
    effects.trigger(ev.attack.type === "counter" ? "slash" : "beast", { x: ex, y: ey, aim, palette: { a: col, b: "#1a0a12", glow: col }, W, H });
    if (dodged) { showStatus("BLOCKED", "blocked"); return; }
    effects.trigger("burst", { x: W / 2, y: H * .82, palette: { a: "#ff3b4e", b: "#8b2bff", glow: "#ff9aa2" }, W, H });
    effects.punchScreen(18, "#ff3b4e"); audio.play("hit");
    state.selfHp = Math.max(0, state.selfHp - ev.attack.dmg); state.surge = Math.min(1, state.surge + .16);
    if (state.selfHp <= 0) campaignDefeat();
  }
}

/* ---------- campaign ---------- */
function setupStage() {
  const s = STAGES[state.stageIndex];
  state.enemy = new Enemy(s);
  hint(`Stage ${state.stageIndex + 1} — exorcise the ${s.name}!`, 2600);
}
function campaignClear() {
  if (state.matchOver) return;
  state.matchOver = true;
  const s = STAGES[state.stageIndex];
  showBanner("K.O."); flashTech("WIN", "#ffcf3a");
  effects.trigger("burst", { x: state.enemy.pos.x * els.fx.width, y: state.enemy.pos.y * els.fx.height, palette: state.char.palette, W: els.fx.width, H: els.fx.height, big: true, sub: "double" });
  const r = rank.recordResult(true); loadout.addCoins(20); toast("+20 cursed coins ◈");
  const next = state.stageIndex + 1; saveProgress(Math.min(next, STAGES.length));
  setTimeout(() => {
    if (next < STAGES.length) { state.stageIndex = next; openStory(false, s.clear); }
    else { openStory(false, s.clear + " · You've cleared the campaign! Now " + r.tier.name + "."); state.stageIndex = 0; saveProgress(0); }
  }, 1500);
}
function campaignDefeat() {
  if (state.matchOver) return;
  state.matchOver = true; clearQte();
  showBanner("K.O."); flashTech("LOSE", "#e3262f");
  setTimeout(() => openStory(true), 1500);
}
function openStory(retry, clearLine) {
  const s = STAGES[state.stageIndex];
  els.storyGlyph.textContent = s.emoji;
  els.storyTitle.textContent = `Stage ${state.stageIndex + 1} · ${s.name}`;
  els.storyText.textContent = retry ? "You were overwhelmed. Steady your breathing — and try again." : (clearLine ? clearLine + "\n\n" + (STAGES[state.stageIndex]?.story || "") : s.story);
  els.storyGo.querySelector(".mode-en").textContent = retry ? "retry" : (clearLine ? "next" : "begin");
  els.story.classList.remove("hidden");
  els.storyGo.onclick = () => { els.story.classList.add("hidden"); audio.play("ui"); enterStage("campaign"); };
}
function startCampaign() {
  ensureCamera().then(() => { state.stageIndex = Math.min(loadProgress(), STAGES.length - 1); state.ranked = false; openStory(false); })
    .catch(() => toast("Camera permission needed 📷"));
}

/* ---------- versus / ranked ---------- */
function receiveAttack(d) {
  const oc = getCharacter(d.char), m = d.move, W = els.fx.width, H = els.fx.height;
  effects.trigger(m.kind, { x: W / 2, y: H * .32, aim: Math.PI / 2, palette: oc.palette, W, H, incoming: true, ...m });
  audio.play("hit");
  if (!state.matchOver) {
    if (state.invuln > 0) { showStatus("BLOCKED", "blocked"); return; }
    state.selfHp = Math.max(0, state.selfHp - (m.dmg || 0)); state.surge = Math.min(1, state.surge + .12);
    versus?.send({ type: "hp", hp: state.selfHp });
    if (state.selfHp <= 0) endMatch(false);
  }
}
function endMatch(win) {
  if (state.matchOver) return;
  state.matchOver = true; showBanner("K.O."); flashTech(win ? "WIN" : "LOSE", win ? "#ffcf3a" : "#e3262f");
  let msg = win ? "Victory — you are the strongest." : "You have been defeated…";
  if (state.ranked) {
    const r = rank.recordResult(win); const sign = r.delta >= 0 ? "+" : "";
    msg += `  ${sign}${r.delta} CE`;
    if (win) { loadout.addCoins(15); toast("+15 cursed coins ◈"); }
    if (r.promoted) msg = `PROMOTED → ${r.tier.name}!  ${sign}${r.delta} CE`;
    else if (r.demoted) msg = `Demoted to ${r.tier.name}.  ${r.delta} CE`;
    renderRankBadge();
  }
  hint(msg, 4500);
  if (win) effects.trigger("domain", { x: els.fx.width / 2, y: els.fx.height / 2, palette: state.char.palette, W: els.fx.width, H: els.fx.height, style: state.char.domain.style || "void" });
}
function newVersus() {
  return new Versus({
    onStatus: (m) => { els.lobbyStatus.textContent = m; els.queueStatus.textContent = m; },
    onConnected: () => { versus.send({ type: "char", id: state.char.id }); els.lobby.classList.add("hidden"); els.queue.classList.add("hidden"); enterStage("versus"); },
    onData: (d) => {
      if (d.type === "char") { state.oppChar = d.id; setFighters(); }
      else if (d.type === "attack") receiveAttack(d);
      else if (d.type === "hp") { state.oppHp = d.hp; if (d.hp <= 0) endMatch(true); }
    },
    onRemoteStream: (rs) => { els.oppVideo.srcObject = rs; els.oppVideo.play().catch(() => {}); },
    onClose: () => { if (state.mode === "versus") { toast("Opponent disconnected"); hint("Opponent left the battle"); } },
  });
}
function openLobby() { els.lobby.classList.remove("hidden"); els.lobbyCode.classList.add("hidden"); els.lobbyStatus.textContent = ""; els.roomInput.value = ""; }
async function startRanked() {
  try { await ensureCamera(); } catch (e) { return toast("Camera permission needed 📷"); }
  state.ranked = true;
  const t = rank.tierFor(rank.load().points);
  els.queueRank.innerHTML = `your grade · <b>${t.name}</b>`; els.queueStatus.textContent = "finding an opponent…";
  els.queue.classList.remove("hidden"); versus = newVersus();
  try { const role = await versus.quickMatch(stream); if (role === "host") els.queueStatus.textContent = "waiting for a challenger… (cross-play)"; else if (!role) els.queueStatus.textContent = "queue busy — close and tap Ranked again."; }
  catch (e) { els.queueStatus.textContent = "matchmaking unavailable (network blocked?)"; }
}

/* ---------- capture ---------- */
async function capture() {
  audio.play("shutter"); shutterFlash();
  const dataURL = composeShot({ video: els.video, fxCanvas: els.fx, character: state.char, techName: state.lastTechName, mirror: state.mirror, artImg: artCache[state.char.id] });
  addThumb(dataURL);
  const r = await postShot(dataURL);
  if (r === "downloaded") toast("Saved cursed photo ⬇"); else if (r === "shared") toast("Posted! ⚡");
}
function addThumb(dataURL) {
  const img = new Image(); img.src = dataURL; img.className = "shot"; img.title = "Tap to share";
  img.onclick = () => postShot(dataURL);
  els.gallery.prepend(img); while (els.gallery.children.length > 4) els.gallery.lastChild.remove();
}
function shutterFlash() {
  const f = document.createElement("div"); f.style.cssText = "position:absolute;inset:0;background:#fff;z-index:9;pointer-events:none";
  els.stage.appendChild(f); f.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 220 }).onfinish = () => f.remove();
}
let toastEl;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement("div"); toastEl.style.cssText = "position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:60;background:rgba(8,14,18,.85);border:1px solid rgba(255,255,255,.18);padding:9px 16px;border-radius:8px;font-weight:700;transition:.3s;opacity:0"; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.style.opacity = "1"; clearTimeout(toastEl._t); toastEl._t = setTimeout(() => (toastEl.style.opacity = "0"), 2200);
}

/* ---------- loadout ---------- */
function openCustomize() { state.czChar = state.char.id; state.czSlot = 0; renderCustomize(); els.customize.classList.remove("hidden"); }
function renderCustomize() {
  const c = getCharacter(state.czChar);
  els.czCoins.textContent = loadout.coins() + " coins";
  els.czTabs.innerHTML = CHARACTERS.map((ch) => `<button class="cz-tab${ch.id === state.czChar ? " active" : ""}" data-c="${ch.id}" style="--accent:${ch.accent}">${ch.name.split(" ")[0]}</button>`).join("");
  els.czTabs.querySelectorAll(".cz-tab").forEach((b) => (b.onclick = () => { state.czChar = b.dataset.c; state.czSlot = 0; audio.play("ui"); renderCustomize(); }));
  const eq = loadout.getEquipped(c.id);
  const slots = eq.map((id, i) => ({ sign: SLOT_SIGNS[i], move: skillById(c, id), idx: i, role: "Slot " + (i + 1) }));
  slots.push({ sign: "double", move: c.ultimate, role: "Ultimate", fixed: true });
  slots.push({ sign: "pray", move: c.domain, role: "Domain", fixed: true });
  els.czSlots.innerHTML = slots.map((s) => {
    const lv = loadout.level(c.id, s.move.id), sel = !s.fixed && s.idx === state.czSlot ? " sel" : "";
    return `<button class="cz-slot${sel}" data-slot="${s.fixed ? -1 : s.idx}" style="--accent:${c.accent}"><span class="lv">Lv${lv}</span><span class="sgn">${signOf(s.sign).emoji}</span><div class="nm">${s.move.short}</div><div class="role">${s.role}</div></button>`;
  }).join("");
  els.czSlots.querySelectorAll(".cz-slot").forEach((b) => { const sl = +b.dataset.slot; if (sl >= 0) b.onclick = () => { state.czSlot = sl; audio.play("ui"); renderCustomize(); }; });
  const items = c.skills.concat([c.ultimate, c.domain]);
  els.czPool.innerHTML = items.map((sk) => {
    const lv = loadout.level(c.id, sk.id), cost = loadout.upgradeCost(c.id, sk.id);
    const dmg = loadout.effective(sk, lv).dmg, eqd = eq.includes(sk.id);
    const fixed = sk.id === c.ultimate.id || sk.id === c.domain.id;
    const badge = eqd ? "equipped" : sk.id === c.ultimate.id ? "ULT" : sk.id === c.domain.id ? "DOM" : "";
    return `<div class="cz-skill${eqd ? " equipped" : ""}" style="--accent:${c.accent}" data-s="${sk.id}" data-fixed="${fixed ? 1 : 0}">${badge ? `<span class="eqd">${badge}</span>` : ""}<div class="nm">${sk.short}</div><div class="ds">${sk.desc || ""}</div><div class="meta"><span class="dmg">${dmg ? "DMG <b>" + dmg + "</b>" : "DEF"} · Lv${lv}</span><button class="up" data-up="${sk.id}" ${cost == null || loadout.coins() < cost ? "disabled" : ""}>${cost == null ? "MAX" : "⬆ " + cost}</button></div></div>`;
  }).join("");
  els.czPool.querySelectorAll(".cz-skill").forEach((card) => {
    card.onclick = (e) => { if (e.target.closest(".up")) return; if (card.dataset.fixed === "1") return toast("Ultimate & Domain are fixed — upgrade with ⬆"); loadout.equip(c.id, state.czSlot, card.dataset.s); state.czSlot = (state.czSlot + 1) % 3; audio.play("ui"); renderCustomize(); };
  });
  els.czPool.querySelectorAll(".up").forEach((btn) => (btn.onclick = (e) => { e.stopPropagation(); if (loadout.upgrade(c.id, btn.dataset.up)) { audio.play("ui"); renderCustomize(); } else toast("Not enough coins"); }));
}

/* ---------- UI ---------- */
function wireUI() {
  document.body.addEventListener("pointerdown", () => audio.unlockAudio(), { once: true });
  document.querySelectorAll(".mode-btn[data-mode]").forEach((b) => {
    b.onclick = () => {
      audio.play("ui"); const mode = b.dataset.mode;
      if (mode === "campaign") startCampaign();
      else if (mode === "ranked") startRanked();
      else if (mode === "versus") { state.ranked = false; ensureCamera().then(() => { versus = newVersus(); openLobby(); }).catch(() => toast("Camera permission needed 📷")); }
      else { state.ranked = false; enterStage("solo"); }
    };
  });
  els.howToBtn.onclick = () => els.help.classList.remove("hidden");
  els.helpClose.onclick = () => els.help.classList.add("hidden");
  els.customizeBtn.onclick = () => { audio.play("ui"); openCustomize(); };
  els.czClose.onclick = () => els.customize.classList.add("hidden");
  els.backBtn.onclick = leaveStage;
  els.captureBtn.onclick = capture;
  els.qte.onclick = () => registerQteInput("tap");
  els.cloakBtn.onclick = () => { state.cloak = !state.cloak; els.cloakBtn.classList.toggle("active", state.cloak); };
  els.cloakBtn.classList.toggle("active", state.cloak);
  els.mirrorBtn.onclick = () => { state.mirror = !state.mirror; };
  els.soundBtn.onclick = () => { audio.setMuted(!audio.muted); els.soundBtn.textContent = audio.muted ? "🔇" : "🔊"; els.soundBtn.classList.toggle("active", !audio.muted); };
  els.createRoom.onclick = async () => { els.lobbyStatus.textContent = "Creating room…"; try { const code = await versus.host(stream); els.codeText.textContent = code; els.lobbyCode.classList.remove("hidden"); } catch (e) { els.lobbyStatus.textContent = "Could not create room."; } };
  els.joinRoom.onclick = async () => { const code = els.roomInput.value.trim().toUpperCase(); if (code.length < 4) return (els.lobbyStatus.textContent = "Enter the room code."); els.lobbyStatus.textContent = "Joining…"; try { await versus.join(code, stream); } catch (e) { els.lobbyStatus.textContent = "Could not join."; } };
  els.copyCode.onclick = () => { navigator.clipboard?.writeText(els.codeText.textContent); toast("Code copied"); };
  els.lobbyClose.onclick = () => { els.lobby.classList.add("hidden"); if (versus) { versus.close(); versus = null; } };
  els.queueClose.onclick = () => { els.queue.classList.add("hidden"); state.ranked = false; if (versus) { versus.close(); versus = null; } };
}

boot();
