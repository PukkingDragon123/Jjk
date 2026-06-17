// JUJUTSU WEB — camera + hand-sign casting + cursed VFX + campaign + versus/ranked.
import { CHARACTERS, getCharacter, moveBySign } from "./characters.js";
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
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[9,10],[10,11],[11,12],
  [13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17],
];

const els = {
  boot: $("#boot"), bootBar: $("#bootBar"), bootMsg: $("#bootMsg"),
  menu: $("#menu"), charGrid: $("#charGrid"), rankBadge: $("#rankBadge"),
  stage: $("#stage"), video: $("#video"), fx: $("#fx"),
  ceFill: $("#ceFill"), fps: $("#fps"), hint: $("#hint"), techFlash: $("#techFlash"), signNow: $("#signNow"),
  hudCharGlyph: $("#hudCharGlyph"), hudCharName: $("#hudCharName"), hudAvatar: $("#hudAvatar"),
  spellbook: $("#spellbook"), history: $("#history"),
  enemyHud: $("#enemyHud"), enemyEmoji: $("#enemyEmoji"), enemyName: $("#enemyName"), enemyHp: $("#enemyHp"), enemyWarn: $("#enemyWarn"),
  versusPanel: $("#versusPanel"), oppVideo: $("#oppVideo"), oppName: $("#oppName"), oppHp: $("#oppHp"), selfHp: $("#selfHp"),
  lobby: $("#lobby"), createRoom: $("#createRoom"), joinRoom: $("#joinRoom"), roomInput: $("#roomInput"),
  lobbyCode: $("#lobbyCode"), codeText: $("#codeText"), copyCode: $("#copyCode"), lobbyStatus: $("#lobbyStatus"), lobbyClose: $("#lobbyClose"),
  queue: $("#queue"), queueStatus: $("#queueStatus"), queueRank: $("#queueRank"), queueClose: $("#queueClose"),
  story: $("#story"), storyGlyph: $("#storyGlyph"), storyTitle: $("#storyTitle"), storyText: $("#storyText"), storyGo: $("#storyGo"),
  help: $("#help"), helpBody: $("#helpBody"), helpClose: $("#helpClose"), howToBtn: $("#howToBtn"),
  cloakBtn: $("#cloakBtn"), captureBtn: $("#captureBtn"), soundBtn: $("#soundBtn"), mirrorBtn: $("#mirrorBtn"), backBtn: $("#backBtn"),
  gallery: $("#gallery"),
};

const ctx = els.fx.getContext("2d");
const tracker = new Tracker();
const gestures = new GestureEngine();
const particles = new ParticleSystem(1400);
const effects = new EffectManager(particles);

const state = {
  mode: "menu", char: CHARACTERS[0], mirror: true, cloak: true,
  ce: 1, running: false, matchOver: false, invuln: 0,
  selfHp: 100, oppHp: 100, oppChar: "gojo", ranked: false,
  aimPos: null, aim: -Math.PI / 2,
  history: [], recent: [], clock: 0,
  stageIndex: 0, enemy: null,
  lastTechName: "", gallery: [],
};
let stream = null, versus = null, spellSlots = [];
const artCache = {};
let lastFrame = performance.now(), fpsT = 0, fpsN = 0;

/* ---------- boot ---------- */
function loadArt() {
  for (const c of CHARACTERS) {
    if (!c.art) continue;
    const img = new Image();
    img.onload = () => { artCache[c.id] = img; refreshAvatar(); };
    img.src = c.art;
  }
}
function renderRankBadge() {
  const p = rank.load(), t = rank.tierFor(p.points), nx = rank.nextTier(p.points);
  const prog = nx ? Math.round(((p.points - t.min) / (nx.min - t.min)) * 100) : 100;
  els.rankBadge.style.setProperty("--accent", t.color);
  els.rankBadge.innerHTML = `<div class="rg" style="color:${t.color}">${t.jp}</div>
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
    card.innerHTML = `<span class="tape"></span>
      <div class="sticker"><div class="art-wrap"><div class="glyph">${c.glyph}</div>
      <img class="art" alt="${c.name}" src="${c.art}" /></div>
      <div class="label"><span class="cname">${c.name}</span><span class="grade">${c.grade}</span></div></div>`;
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
    ["🤚", "Cast with hand signs", "Each spell has a sign shown in the spellbook. Hold the sign for a moment to cast it."],
    ["✋✊", "Basics", "Form the sign (open palm, fist, one finger, two fingers) shown under each basic spell."],
    ["👐", "Ultimate", "Open BOTH hands together — costs cursed energy (the bar at the top)."],
    ["🙏", "Domain", "Clasp BOTH hands when your energy is FULL to expand your Domain."],
    ["🔗", "Combos", "Chain the basic signs in order (e.g. Blue → Red) to trigger an anime finisher."],
    ["👆", "No camera AI?", "Just tap a spell card in the spellbook — works on any device."],
    ["👹", "Campaign", "Fight cursed spirits across a short story. Read their attack rhythm and time your domain."],
    ["⚔️", "Ranked / Versus", "Battle real people cross-play — matchmaking or a room code."],
  ];
  els.helpBody.innerHTML = rows.map(([g, t, d]) => `<div class="help-row"><div class="g">${g}</div><div><b>${t}</b><p>${d}</p></div></div>`).join("");
}

/* ---------- spellbook ---------- */
function buildSpellbook() {
  els.spellbook.innerHTML = ""; spellSlots = [];
  for (const m of state.char.moves) {
    const sl = document.createElement("button");
    sl.className = "spell"; sl.style.setProperty("--accent", state.char.accent);
    const tag = m.tier === "ultimate" ? "ULT" : m.tier === "domain" ? "DOM" : "";
    sl.innerHTML = `${tag ? `<span class="tag">${tag}</span>` : ""}<span class="sgn">${signOf(m.sign).emoji}</span>
      <span class="snm">${m.name}</span><span class="ring"><span></span></span>`;
    sl.onclick = () => cast(m, { tap: true });
    els.spellbook.appendChild(sl);
    spellSlots.push({ el: sl, move: m, ring: sl.querySelector(".ring span") });
  }
}
function updateSpellbook(activeSign, progress) {
  for (const s of spellSlots) {
    const locked = s.move.cost && state.ce < s.move.cost;
    s.el.classList.toggle("locked", !!locked);
    const active = activeSign && s.move.sign === activeSign;
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

/* ---------- stage ---------- */
async function enterStage(mode) {
  try { await ensureCamera(); } catch (e) { return toast("Camera permission needed 📷"); }
  state.mode = mode; state.ce = 1; state.selfHp = 100; state.oppHp = 100; state.matchOver = false;
  state.invuln = 0; state.history = []; state.recent = [];
  particles.clear(); effects.fx.length = 0; renderHistory();
  els.menu.classList.add("hidden"); els.stage.classList.remove("hidden");
  els.versusPanel.classList.toggle("hidden", mode !== "versus");
  els.enemyHud.classList.toggle("hidden", mode !== "campaign");
  if (playerHp()) playerHp().style.display = mode === "campaign" ? "block" : "none";
  els.hudCharName.textContent = state.char.name.split(" ")[0];
  els.hudCharGlyph.style.color = state.char.accent;
  refreshAvatar(); buildSpellbook(); resize();
  if (mode === "campaign") setupStage();
  updateVersusHp();
  if (!state.running) { state.running = true; requestAnimationFrame(loop); }
  if (mode === "solo") hint("Form a hand sign to cast — see the spellbook below ⚡", 3000);
}
function leaveStage() {
  state.mode = "menu"; state.ranked = false; state.enemy = null;
  if (versus) { versus.close(); versus = null; }
  els.stage.classList.add("hidden"); els.menu.classList.remove("hidden");
  renderRankBadge();
}

/* ---------- main loop ---------- */
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

  let g = { hands: [], sign: null, progress: 0, cast: null, pos: null, aim: -Math.PI / 2 };
  if (tracker.mode === "hands" && els.video.readyState >= 2) {
    g = gestures.process(tracker.detect(els.video, now), makeMap(), now);
  }
  if (g.pos) { state.aimPos = g.pos; state.aim = g.aim; }
  if (!effects.domainActive) state.ce = Math.min(1, state.ce + dt * 0.09);
  if (state.invuln > 0) state.invuln -= dt;

  if (g.cast) { const m = moveBySign(state.char, g.cast); if (m) cast(m, {}); }

  // ambient aura at hands
  for (const h of g.hands) particles.aura(h.center.x, h.center.y, state.char.palette.glow, 1, state.cloak ? 2 : 1);

  if (state.mode === "campaign") updateCampaign(dt);

  particles.update(dt); effects.update(dt);

  const sh = effects.shake, ox = sh ? (Math.random() * 2 - 1) * sh : 0, oy = sh ? (Math.random() * 2 - 1) * sh : 0;
  els.video.style.transform = `${state.mirror ? "scaleX(-1) " : ""}translate(${state.mirror ? -ox : ox}px,${oy}px) scale(1.04)`;

  ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.translate(ox, oy);
  effects.renderUnder(ctx, W, H);
  drawAura(ctx, g.hands); drawHandRig(ctx, g.hands);
  particles.render(ctx); effects.render(ctx, W, H);
  ctx.restore();

  els.ceFill.style.width = state.ce * 100 + "%";
  updateSpellbook(g.sign, g.progress);
  updateSignNow(g.sign, g.progress);
  fpsN++; fpsT += dt; if (fpsT >= 0.5) { els.fps.textContent = Math.round(fpsN / fpsT) + " fps"; fpsN = 0; fpsT = 0; }
  requestAnimationFrame(loop);
}
function updateSignNow(sign, progress) {
  if (!sign) { els.signNow.classList.remove("show"); return; }
  els.signNow.classList.add("show");
  els.signNow.style.setProperty("--p", progress);
  els.signNow.innerHTML = `<b>${signOf(sign).emoji}</b>`;
}
function drawAura(ctx, hands) {
  if (!hands.length) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const h of hands) {
    const r = h.palmW * 1.7;
    const grd = ctx.createRadialGradient(h.center.x, h.center.y, 0, h.center.x, h.center.y, r);
    grd.addColorStop(0, state.char.palette.glow + "cc"); grd.addColorStop(0.5, state.char.palette.a + "55"); grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(h.center.x, h.center.y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function drawHandRig(ctx, hands) {
  if (!hands.length) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = state.char.palette.glow + "aa";
  for (const h of hands) {
    ctx.lineWidth = Math.max(1.5, h.palmW * 0.05);
    for (const [a, b] of HAND_CONNECTIONS) { ctx.beginPath(); ctx.moveTo(h.px[a].x, h.px[a].y); ctx.lineTo(h.px[b].x, h.px[b].y); ctx.stroke(); }
    ctx.fillStyle = "#fff";
    for (const tip of [4, 8, 12, 16, 20]) { ctx.beginPath(); ctx.arc(h.px[tip].x, h.px[tip].y, Math.max(2, h.palmW * 0.06), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

/* ---------- casting ---------- */
function cast(move, opts = {}) {
  if (!move) return;
  const W = els.fx.width, H = els.fx.height;
  const pos = state.aimPos || { x: W / 2, y: H * 0.5 };
  if (!doCast(move, pos, state.aim, { combo: opts.combo })) return;
  flashSlot(move.id);
  if (!opts.combo && move.tier === "basic") feedCombo(move.id);
}
function doCast(move, pos, aim, { incoming = false, fromCharId = null, combo = false } = {}) {
  const char = incoming ? getCharacter(fromCharId || state.oppChar) : state.char;
  if (!incoming) {
    const cost = move.cost || 0;
    if (cost && state.ce < cost) { hint("Not enough cursed energy for " + move.name); return false; }
    state.ce = Math.max(0, state.ce - cost);
  }
  const W = els.fx.width, H = els.fx.height;
  effects.trigger(move.kind, { x: pos.x, y: pos.y, aim, palette: char.palette, W, H, incoming, ...move });
  audio.play(move.sfx || "blue");
  flashTech(move.jp, char.accent);
  if (!incoming) {
    state.lastTechName = move.name;
    pushHistory(move, combo);
    if (move.tier === "domain") state.invuln = 2.2;
    if (state.mode === "campaign" && state.enemy && !state.enemy.dead) {
      if (state.enemy.damage(move.dmg)) campaignClear(); updateCampaignHp();
    }
    if (state.mode === "versus" && versus) versus.send({ type: "attack", char: char.id, move: serialize(move) });
  }
  return true;
}
function feedCombo(id) {
  state.recent.push({ id, t: state.clock });
  state.recent = state.recent.filter((r) => state.clock - r.t < 2.6);
  const ids = state.recent.map((r) => r.id);
  for (const c of state.char.combos || []) {
    if (ids.length >= c.seq.length && c.seq.every((s, i) => ids[ids.length - c.seq.length + i] === s)) {
      state.recent = [];
      hint("⚡ COMBO · " + c.result.name);
      cast(c.result, { combo: true });
      break;
    }
  }
}
function serialize(m) {
  return { kind: m.kind, jp: m.jp, name: m.name, dmg: m.dmg, style: m.style, sub: m.sub, warm: m.warm, water: m.water, barrage: m.barrage, big: m.big };
}
function pushHistory(move, combo) {
  state.history.unshift({ emoji: combo ? "🔥" : signOf(move.sign).emoji, name: move.name, combo });
  state.history = state.history.slice(0, 6);
  renderHistory();
}
function renderHistory() {
  els.history.innerHTML = state.history.map((h) => `<div class="h${h.combo ? " combo" : ""}"><span class="he">${h.emoji}</span>${h.name}</div>`).join("");
}
function flashTech(text, color) {
  els.techFlash.textContent = text;
  els.techFlash.style.color = "#fff";
  els.techFlash.style.textShadow = `0 0 30px ${color}, 0 0 60px ${color}`;
  els.techFlash.classList.remove("go"); void els.techFlash.offsetWidth; els.techFlash.classList.add("go");
}
let hintTimer;
function hint(text, ms = 1500) { els.hint.textContent = text; els.hint.classList.add("show"); clearTimeout(hintTimer); hintTimer = setTimeout(() => els.hint.classList.remove("show"), ms); }
function refreshAvatar() {
  const img = artCache[state.char.id];
  if (img) { els.hudAvatar.src = img.src; els.hudAvatar.style.display = "block"; els.hudCharGlyph.style.display = "none"; }
  else { els.hudAvatar.style.display = "none"; els.hudCharGlyph.style.display = ""; els.hudCharGlyph.textContent = state.char.glyph; }
}

/* ---------- campaign ---------- */
let _php;
function playerHp() { return _php; }
function ensurePlayerHp() {
  if (_php) return _php;
  _php = document.createElement("div");
  _php.id = "playerHp";
  _php.style.cssText = "position:absolute;top:96px;left:12px;z-index:5;width:188px;background:rgba(8,6,12,.75);border:3px solid #000;border-radius:10px;padding:5px 9px;box-shadow:3px 3px 0 rgba(0,0,0,.5);font-weight:700;font-size:.72rem";
  _php.innerHTML = 'YOU<div class="hp-bar self" style="margin-top:3px"><span></span></div>';
  els.stage.appendChild(_php); _php._span = _php.querySelector("span");
  return _php;
}
function setupStage() {
  const s = STAGES[state.stageIndex];
  state.enemy = new Enemy(s);
  els.enemyEmoji.textContent = s.emoji;
  els.enemyName.textContent = `${s.name} · ${s.jp}`;
  els.enemyName.style.color = s.color;
  ensurePlayerHp().style.display = "block";
  updateCampaignHp();
  hint(`Stage ${state.stageIndex + 1} — exorcise the ${s.name}!`, 2600);
}
function updateCampaign(dt) {
  if (state.matchOver || !state.enemy) return;
  const ev = state.enemy.update(dt);
  if (ev?.telegraph) { els.enemyWarn.textContent = "⚠ " + ev.telegraph; els.enemyWarn.classList.add("show"); }
  if (ev?.attack) {
    els.enemyWarn.classList.remove("show");
    if (state.invuln > 0) { hint("Domain absorbs the attack!"); }
    else {
      const W = els.fx.width, H = els.fx.height;
      effects.trigger("burst", { x: W / 2, y: H * 0.6, aim: 0, palette: { a: "#ff3b4e", b: "#8b2bff", glow: "#ff9aa2" }, W, H });
      effects.punchScreen(16, "#ff3b4e"); audio.play("hit");
      state.selfHp = Math.max(0, state.selfHp - ev.attack.dmg); updateCampaignHp();
      if (state.selfHp <= 0) campaignDefeat();
    }
  }
}
function updateCampaignHp() {
  if (state.enemy) els.enemyHp.style.width = state.enemy.pct * 100 + "%";
  if (_php) _php._span.style.width = state.selfHp + "%";
}
function campaignClear() {
  if (state.matchOver) return;
  state.matchOver = true;
  const s = STAGES[state.stageIndex];
  flashTech("勝", "#ffc23b");
  effects.trigger("burst", { x: els.fx.width / 2, y: els.fx.height * 0.32, palette: state.char.palette, W: els.fx.width, H: els.fx.height, big: true, sub: "double" });
  const r = rank.recordResult(true);
  const next = state.stageIndex + 1;
  saveProgress(Math.min(next, STAGES.length));
  setTimeout(() => {
    if (next < STAGES.length) { state.stageIndex = next; openStory(false, s.clear); }
    else { openStory(false, s.clear + " · You've cleared the campaign! +" + r.delta + " CE — now " + r.tier.name + "."); state.stageIndex = 0; saveProgress(0); }
  }, 1400);
}
function campaignDefeat() {
  if (state.matchOver) return;
  state.matchOver = true;
  flashTech("敗", "#ff2e3e");
  setTimeout(() => openStory(true), 1400);
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
  ensureCamera().then(() => {
    state.stageIndex = Math.min(loadProgress(), STAGES.length - 1);
    state.ranked = false;
    openStory(false);
  }).catch(() => toast("Camera permission needed 📷"));
}

/* ---------- versus / ranked ---------- */
function receiveAttack(d) {
  const oc = getCharacter(d.char), m = d.move, W = els.fx.width, H = els.fx.height;
  effects.trigger(m.kind, { x: W / 2, y: H * 0.32, aim: Math.PI / 2, palette: oc.palette, W, H, incoming: true, ...m });
  audio.play("hit");
  if (!state.matchOver) {
    state.selfHp = Math.max(0, state.selfHp - (m.dmg || 0)); updateVersusHp();
    versus?.send({ type: "hp", hp: state.selfHp });
    if (state.selfHp <= 0) endMatch(false);
  }
}
function updateVersusHp() { els.selfHp.style.width = state.selfHp + "%"; els.oppHp.style.width = state.oppHp + "%"; }
function endMatch(win) {
  if (state.matchOver) return;
  state.matchOver = true;
  flashTech(win ? "勝" : "敗", win ? "#ffc23b" : "#ff2e3e");
  let msg = win ? "Victory — you are the strongest." : "You have been defeated…";
  if (state.ranked) {
    const r = rank.recordResult(win); const sign = r.delta >= 0 ? "+" : "";
    msg += `  ${sign}${r.delta} CE`;
    if (r.promoted) { msg = `PROMOTED → ${r.tier.name}!  ${sign}${r.delta} CE`; flashTech(r.tier.jp, r.tier.color); }
    else if (r.demoted) msg = `Demoted to ${r.tier.name}.  ${r.delta} CE`;
    renderRankBadge();
  }
  hint(msg, 4500);
  if (win) effects.trigger("domain", { x: els.fx.width / 2, y: els.fx.height / 2, palette: state.char.palette, W: els.fx.width, H: els.fx.height, style: state.char.moves[3]?.style || "void" });
}
function newVersus() {
  return new Versus({
    onStatus: (m) => { els.lobbyStatus.textContent = m; els.queueStatus.textContent = m; },
    onConnected: () => {
      versus.send({ type: "char", id: state.char.id });
      els.lobby.classList.add("hidden"); els.queue.classList.add("hidden");
      enterStage("versus");
      hint(state.ranked ? "RANKED — win to climb the grades!" : "Fight!", 2600);
    },
    onData: (d) => {
      if (d.type === "char") { state.oppChar = d.id; els.oppName.textContent = getCharacter(d.id).name.split(" ")[0]; }
      else if (d.type === "attack") receiveAttack(d);
      else if (d.type === "hp") { state.oppHp = d.hp; updateVersusHp(); if (d.hp <= 0) endMatch(true); }
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
  els.queueRank.innerHTML = `your grade · <b>${t.name}</b> ${t.jp}`;
  els.queueStatus.textContent = "finding an opponent…";
  els.queue.classList.remove("hidden");
  versus = newVersus();
  try {
    const role = await versus.quickMatch(stream);
    if (role === "host") els.queueStatus.textContent = "waiting for a challenger… (cross-play)";
    else if (!role) els.queueStatus.textContent = "queue busy — close and tap Ranked again.";
  } catch (e) { els.queueStatus.textContent = "matchmaking unavailable (network blocked?)"; }
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
  const f = document.createElement("div");
  f.style.cssText = "position:absolute;inset:0;background:#fff;z-index:7;pointer-events:none";
  els.stage.appendChild(f);
  f.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 220 }).onfinish = () => f.remove();
}
let toastEl;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement("div"); toastEl.style.cssText = "position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:60;background:rgba(0,0,0,.82);border:2px solid rgba(255,255,255,.18);padding:9px 16px;border-radius:30px;font-weight:700;transition:.3s;opacity:0"; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.style.opacity = "1"; clearTimeout(toastEl._t); toastEl._t = setTimeout(() => (toastEl.style.opacity = "0"), 2200);
}

/* ---------- UI ---------- */
function wireUI() {
  document.body.addEventListener("pointerdown", () => audio.unlockAudio(), { once: true });
  document.querySelectorAll(".mode-btn[data-mode]").forEach((b) => {
    b.onclick = () => {
      audio.play("ui");
      const mode = b.dataset.mode;
      if (mode === "campaign") startCampaign();
      else if (mode === "ranked") startRanked();
      else if (mode === "versus") { state.ranked = false; ensureCamera().then(() => { versus = newVersus(); openLobby(); }).catch(() => toast("Camera permission needed 📷")); }
      else { state.ranked = false; enterStage("solo"); }
    };
  });
  els.howToBtn.onclick = () => els.help.classList.remove("hidden");
  els.helpClose.onclick = () => els.help.classList.add("hidden");
  els.backBtn.onclick = leaveStage;
  els.captureBtn.onclick = capture;
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
