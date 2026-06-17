// JUJUTSU WEB — camera + AI hand tracking + cursed-energy VFX + versus battles.
import { CHARACTERS, getCharacter } from "./characters.js";
import { Tracker } from "./tracking.js";
import { GestureEngine } from "./gestures.js";
import { ParticleSystem } from "./vfx/particles.js";
import { EffectManager } from "./vfx/techniques.js";
import { Versus } from "./multiplayer.js";
import { composeShot, postShot } from "./capture.js";
import * as audio from "./audio.js";
import * as rank from "./rank.js";

const $ = (s) => document.querySelector(s);
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [9,10],[10,11],[11,12],
  [13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

const els = {
  boot: $("#boot"), bootBar: $("#bootBar"), bootMsg: $("#bootMsg"),
  menu: $("#menu"), charGrid: $("#charGrid"), rankBadge: $("#rankBadge"),
  stage: $("#stage"), video: $("#video"), fx: $("#fx"),
  ceFill: $("#ceFill"), fps: $("#fps"), hint: $("#hint"), techFlash: $("#techFlash"),
  hudCharGlyph: $("#hudCharGlyph"), hudCharName: $("#hudCharName"), hudAvatar: $("#hudAvatar"),
  queue: $("#queue"), queueStatus: $("#queueStatus"), queueRank: $("#queueRank"), queueClose: $("#queueClose"),
  domainBtn: $("#domainBtn"), captureBtn: $("#captureBtn"), cloakBtn: $("#cloakBtn"),
  soundBtn: $("#soundBtn"), mirrorBtn: $("#mirrorBtn"), backBtn: $("#backBtn"),
  gallery: $("#gallery"),
  versusPanel: $("#versusPanel"), oppVideo: $("#oppVideo"), oppName: $("#oppName"),
  oppHp: $("#oppHp"), selfHp: $("#selfHp"),
  lobby: $("#lobby"), createRoom: $("#createRoom"), joinRoom: $("#joinRoom"),
  roomInput: $("#roomInput"), lobbyCode: $("#lobbyCode"), codeText: $("#codeText"),
  copyCode: $("#copyCode"), lobbyStatus: $("#lobbyStatus"), lobbyClose: $("#lobbyClose"),
  help: $("#help"), helpBody: $("#helpBody"), helpClose: $("#helpClose"), howToBtn: $("#howToBtn"),
};

const ctx = els.fx.getContext("2d");
const tracker = new Tracker();
const gestures = new GestureEngine();
const particles = new ParticleSystem(1500);
const effects = new EffectManager(particles);

const state = {
  mode: "menu",          // 'solo' | 'versus'
  char: CHARACTERS[0],
  mirror: true,
  cloak: true,
  ce: 0,
  running: false,
  selfHp: 100, oppHp: 100, oppChar: "gojo",
  lastTechName: "",
  gallery: [],
  pointer: { down: false, x: 0, y: 0, t: 0, charging: false },
  lastTap: 0,
  matchOver: false,
  ranked: false,
};
let stream = null;
let versus = null;
const artCache = {}; // id -> loaded HTMLImageElement (fan-art, if present)
let lastFrame = performance.now(), fpsT = 0, fpsN = 0;

/* ----------------------------- boot ----------------------------- */
function loadArt() {
  for (const c of CHARACTERS) {
    if (!c.art) continue;
    const img = new Image();
    img.onload = () => { artCache[c.id] = img; refreshAvatar(); };
    img.src = c.art;
  }
}

function renderRankBadge() {
  const p = rank.load();
  const t = rank.tierFor(p.points);
  const nx = rank.nextTier(p.points);
  const prog = nx ? Math.round(((p.points - t.min) / (nx.min - t.min)) * 100) : 100;
  els.rankBadge.style.setProperty("--accent", t.color);
  els.rankBadge.innerHTML = `
    <div class="rg" style="color:${t.color}">${t.jp}</div>
    <div class="rinfo">
      <span class="rname">${t.name}</span>
      <span class="rpts">${p.points} CE · ${p.wins}W / ${p.losses}L</span>
      <span class="rprog"><span style="width:${prog}%;background:${t.color}"></span></span>
    </div>`;
}

async function boot() {
  loadArt();
  renderRankBadge();
  buildCharGrid();
  buildHelp();
  wireUI();
  let p = 0;
  const tick = setInterval(() => { p = Math.min(0.85, p + 0.05); els.bootBar.style.width = p * 100 + "%"; }, 120);
  const mode = await tracker.init((v, msg) => { p = Math.max(p, v); els.bootBar.style.width = p * 100 + "%"; if (msg) els.bootMsg.textContent = msg; });
  clearInterval(tick);
  els.bootBar.style.width = "100%";
  els.bootMsg.textContent = mode === "hands" ? "Cursed sight online." : "Tap-to-cast mode (no camera AI).";
  setTimeout(() => { els.boot.classList.add("hidden"); els.menu.classList.remove("hidden"); }, 500);
}

/* ----------------------------- menu ----------------------------- */
function buildCharGrid() {
  els.charGrid.innerHTML = "";
  CHARACTERS.forEach((c, i) => {
    const card = document.createElement("button");
    card.className = "char-card" + (i === 0 ? " sel" : "");
    card.style.setProperty("--accent", c.accent);
    card.innerHTML = `
      <span class="tape"></span>
      <div class="sticker">
        <div class="art-wrap">
          <div class="glyph">${c.glyph}</div>
          <img class="art" alt="${c.name}" src="${c.art}" />
        </div>
        <div class="label">
          <span class="cname">${c.name}</span>
          <span class="grade">${c.grade}</span>
        </div>
      </div>`;
    // fan-art is optional: hide the <img> and show the stencil glyph if it isn't there
    const img = card.querySelector(".art");
    img.addEventListener("error", () => { img.style.display = "none"; });
    card.onclick = () => {
      state.char = c;
      audio.play("ui");
      [...els.charGrid.children].forEach((n) => n.classList.remove("sel"));
      card.classList.add("sel");
    };
    els.charGrid.appendChild(card);
  });
}

function buildHelp() {
  const rows = [
    ["✋", "Charge", "Hold an open palm steady to gather cursed energy. Aura grows around your hand."],
    ["👉", "Blast", "Thrust / push an open palm fast to fire your character's blast technique."],
    ["✊", "Melee", "Throw a fast punch (fist) to unleash a close-range strike (e.g. Black Flash)."],
    ["🙌", "Special", "Bring BOTH hands together to release your signature move (Hollow Purple, Fire Arrow…)."],
    ["🛐", "Domain", "Clasp both hands & hold when your energy bar is FULL to expand your Domain."],
    ["👆", "Tap screen", "No camera AI? Tap to blast, double-tap for special, hold to charge — always works."],
    ["📸", "Capture", "Snap a framed cursed photo and share/post it."],
    ["⚔️", "Versus", "Create or join a room code to battle a friend — phone vs laptop, any browser."],
    ["🏆", "Ranked", "Auto-matchmake a real opponent. Win to climb Grade 4 → Special Grade."],
    ["✦", "Cross-play", "It's all in the browser, so it just works across devices and platforms."],
  ];
  els.helpBody.innerHTML = rows.map(([g, t, d]) => `<div class="help-row"><div class="g">${g}</div><div><b>${t}</b><p>${d}</p></div></div>`).join("");
}

/* ----------------------------- camera ----------------------------- */
async function ensureCamera() {
  if (stream) return stream;
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  els.video.srcObject = stream;
  await els.video.play().catch(() => {});
  return stream;
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  els.fx.width = Math.round(els.fx.clientWidth * dpr);
  els.fx.height = Math.round(els.fx.clientHeight * dpr);
}
window.addEventListener("resize", resize);

/* ----------------------------- stage ----------------------------- */
async function enterStage(mode) {
  try { await ensureCamera(); }
  catch (e) { toast("Camera permission needed to play 📷"); return; }
  state.mode = mode;
  state.ce = 0; state.selfHp = 100; state.oppHp = 100; state.matchOver = false;
  particles.clear(); effects.fx.length = 0;
  els.menu.classList.add("hidden");
  els.stage.classList.remove("hidden");
  els.versusPanel.classList.toggle("hidden", mode !== "versus");
  els.hudCharName.textContent = state.char.name.split(" ")[0];
  els.hudCharGlyph.style.color = state.char.accent;
  refreshAvatar();
  resize();
  updateHp();
  if (!state.running) { state.running = true; requestAnimationFrame(loop); }
  hint(mode === "versus" ? "Fight! Cast techniques to damage your opponent." : "Channel your cursed energy ⚡", 2600);
}

function refreshAvatar() {
  const img = artCache[state.char.id];
  if (img) { els.hudAvatar.src = img.src; els.hudAvatar.style.display = "block"; els.hudCharGlyph.style.display = "none"; }
  else { els.hudAvatar.style.display = "none"; els.hudCharGlyph.style.display = ""; els.hudCharGlyph.textContent = state.char.glyph; }
}

function leaveStage() {
  state.mode = "menu";
  state.ranked = false;
  if (versus) { versus.close(); versus = null; }
  els.stage.classList.add("hidden");
  els.menu.classList.remove("hidden");
  renderRankBadge();
}

/* ----------------------------- render loop ----------------------------- */
function makeMap() {
  const vw = els.video.videoWidth || 1280, vh = els.video.videoHeight || 720;
  const W = els.fx.width, H = els.fx.height;
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale, dh = vh * scale, dx = (W - dw) / 2, dy = (H - dh) / 2;
  return (p) => ({ x: dx + (state.mirror ? 1 - p.x : p.x) * dw, y: dy + p.y * dh, z: p.z || 0 });
}

function loop(now) {
  if (!state.running) return;
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const W = els.fx.width, H = els.fx.height;

  // ---- tracking + gestures ----
  let g = { charging: false, chargePos: null, events: [], hands: [] };
  if (tracker.mode === "hands" && els.video.readyState >= 2) {
    const res = tracker.detect(els.video, now);
    g = gestures.process(res, makeMap(), now);
  }
  // pointer-charge contributes too
  if (state.pointer.charging) { g.charging = true; g.chargePos = { x: state.pointer.x, y: state.pointer.y }; }

  // energy + charge fx
  if (g.charging && g.chargePos && !effects.domainActive) {
    state.ce = Math.min(1, state.ce + dt * 0.4);
    particles.implode(g.chargePos.x, g.chargePos.y, state.char.palette.a, 1.4, 5, 120);
    particles.aura(g.chargePos.x, g.chargePos.y, state.char.palette.glow, 1.2, 2);
  }
  // gesture events
  for (const ev of g.events) fireTech(ev.type, ev.x, ev.y, ev.aim);

  // ---- update sim ----
  particles.update(dt);
  effects.update(dt);

  // ---- shake on video + canvas ----
  const sh = effects.shake;
  const ox = sh ? (Math.random() * 2 - 1) * sh : 0;
  const oy = sh ? (Math.random() * 2 - 1) * sh : 0;
  els.video.style.transform = `${state.mirror ? "scaleX(-1) " : ""}translate(${state.mirror ? -ox : ox}px,${oy}px) scale(1.04)`;

  // ---- draw ----
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(ox, oy);
  effects.renderUnder(ctx, W, H);
  drawAura(ctx, g.hands);
  drawHandRig(ctx, g.hands);
  particles.render(ctx);
  effects.render(ctx, W, H);
  ctx.restore();

  // ---- HUD ----
  els.ceFill.style.width = state.ce * 100 + "%";
  els.domainBtn.disabled = state.ce < 1 || effects.domainActive;
  fpsN++; fpsT += dt;
  if (fpsT >= 0.5) { els.fps.textContent = Math.round(fpsN / fpsT) + " fps"; fpsN = 0; fpsT = 0; }

  requestAnimationFrame(loop);
}

function drawAura(ctx, hands) {
  if (!hands.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const h of hands) {
    const r = h.palmW * 1.6;
    const grd = ctx.createRadialGradient(h.center.x, h.center.y, 0, h.center.x, h.center.y, r);
    grd.addColorStop(0, state.char.palette.glow + "cc");
    grd.addColorStop(0.5, state.char.palette.a + "55");
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(h.center.x, h.center.y, r, 0, Math.PI * 2); ctx.fill();
    if (state.cloak) for (let i = 1; i < h.px.length; i += 4) particles.aura(h.px[i].x, h.px[i].y, state.char.palette.glow, 0.9, 1);
  }
  ctx.restore();
}

function drawHandRig(ctx, hands) {
  if (!hands.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = state.char.palette.glow + "aa";
  for (const h of hands) {
    ctx.lineWidth = Math.max(1.5, h.palmW * 0.05);
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath(); ctx.moveTo(h.px[a].x, h.px[a].y); ctx.lineTo(h.px[b].x, h.px[b].y); ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    for (const tip of [4, 8, 12, 16, 20]) {
      ctx.beginPath(); ctx.arc(h.px[tip].x, h.px[tip].y, Math.max(2, h.palmW * 0.06), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/* ----------------------------- techniques ----------------------------- */
const COST = { blast: 0.12, melee: 0.12, special: 0.4, domain: 1 };

function fireTech(slot, x, y, aim, incoming = false, fromCharId = null) {
  const char = incoming ? getCharacter(fromCharId || state.oppChar) : state.char;
  const move = char.moves[slot];
  if (!move) return;

  if (!incoming) {
    if (slot === "special" && state.ce < COST.special) return hint("Not enough cursed energy for " + move.name);
    if (slot === "domain" && state.ce < 1) return hint("Domain Expansion needs full energy");
    state.ce = Math.max(0, state.ce - (COST[slot] || 0));
  }

  const W = els.fx.width, H = els.fx.height;
  const opts = { x, y, aim, palette: char.palette, W, H, incoming, ...move };
  effects.trigger(move.kind, opts);
  audio.play(move.sfx);
  flashTech(move.jp, char.accent);
  if (!incoming) {
    state.lastTechName = move.name;
    hint(move.name);
    if (state.mode === "versus" && versus) {
      versus.send({ type: "attack", slot, dmg: move.dmg, char: char.id, jp: move.jp, name: move.name });
    }
  }
}

function flashTech(text, color) {
  els.techFlash.textContent = text;
  els.techFlash.style.color = "#fff";
  els.techFlash.style.textShadow = `0 0 30px ${color}, 0 0 60px ${color}`;
  els.techFlash.classList.remove("go"); void els.techFlash.offsetWidth; els.techFlash.classList.add("go");
}

let hintTimer;
function hint(text, ms = 1600) {
  els.hint.textContent = text; els.hint.classList.add("show");
  clearTimeout(hintTimer); hintTimer = setTimeout(() => els.hint.classList.remove("show"), ms);
}

/* ----------------------------- versus ----------------------------- */
function receiveAttack(d) {
  const oc = getCharacter(d.char);
  const W = els.fx.width, H = els.fx.height;
  fireTech(d.slot, W / 2, H * 0.32, Math.PI / 2, true, d.char);
  audio.play("hit");
  if (!state.matchOver) {
    state.selfHp = Math.max(0, state.selfHp - d.dmg);
    updateHp();
    versus?.send({ type: "hp", hp: state.selfHp });
    if (state.selfHp <= 0) endMatch(false);
  }
}

function updateHp() {
  els.selfHp.style.width = state.selfHp + "%";
  els.oppHp.style.width = state.oppHp + "%";
}

function endMatch(win) {
  if (state.matchOver) return;
  state.matchOver = true;
  flashTech(win ? "勝" : "敗", win ? "#ffc23b" : "#ff2e3e");
  let msg = win ? "Victory — you are the strongest." : "You have been defeated…";
  if (state.ranked) {
    const r = rank.recordResult(win);
    const sign = r.delta >= 0 ? "+" : "";
    msg += `  ${sign}${r.delta} CE`;
    if (r.promoted) { msg = `PROMOTED → ${r.tier.name}!  ${sign}${r.delta} CE`; flashTech(r.tier.jp, r.tier.color); }
    else if (r.demoted) msg = `Demoted to ${r.tier.name}.  ${r.delta} CE`;
    renderRankBadge();
  }
  hint(msg, 4500);
  if (win) effects.trigger("domain", { x: els.fx.width / 2, y: els.fx.height / 2, palette: state.char.palette, W: els.fx.width, H: els.fx.height, style: state.char.moves.domain.style || "void" });
}

function openLobby() {
  els.lobby.classList.remove("hidden");
  els.lobbyCode.classList.add("hidden");
  els.lobbyStatus.textContent = "";
  els.roomInput.value = "";
}

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

function newVersus() {
  return new Versus({
    onStatus: (m) => (els.lobbyStatus.textContent = m),
    onConnected: () => {
      versus.send({ type: "char", id: state.char.id });
      els.lobby.classList.add("hidden");
      els.queue.classList.add("hidden");
      enterStage("versus");
      hint(state.ranked ? "RANKED — win to climb the grades!" : "Fight!", 2600);
    },
    onData: (d) => {
      if (d.type === "char") { state.oppChar = d.id; els.oppName.textContent = getCharacter(d.id).name.split(" ")[0]; }
      else if (d.type === "attack") receiveAttack(d);
      else if (d.type === "hp") { state.oppHp = d.hp; updateHp(); if (d.hp <= 0) endMatch(true); }
    },
    onRemoteStream: (rs) => { els.oppVideo.srcObject = rs; els.oppVideo.play().catch(() => {}); },
    onClose: () => { if (state.mode === "versus") { toast("Opponent disconnected"); hint("Opponent left the battle"); } },
  });
}

/* ----------------------------- capture ----------------------------- */
async function capture() {
  audio.play("shutter");
  shutterFlash();
  const dataURL = composeShot({
    video: els.video, fxCanvas: els.fx, character: state.char,
    techName: state.lastTechName, mirror: state.mirror, artImg: artCache[state.char.id],
  });
  addThumb(dataURL);
  const result = await postShot(dataURL);
  if (result === "downloaded") toast("Saved cursed photo ⬇");
  else if (result === "shared") toast("Posted! ⚡");
}

function addThumb(dataURL) {
  const img = new Image();
  img.src = dataURL; img.className = "shot";
  img.title = "Tap to share";
  img.onclick = () => postShot(dataURL);
  els.gallery.prepend(img);
  state.gallery.unshift(dataURL);
  while (els.gallery.children.length > 4) els.gallery.lastChild.remove();
}

function shutterFlash() {
  const f = document.createElement("div");
  f.style.cssText = "position:absolute;inset:0;background:#fff;z-index:6;pointer-events:none;animation:popIn .05s";
  els.stage.appendChild(f);
  f.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 220 }).onfinish = () => f.remove();
}

/* ----------------------------- toast ----------------------------- */
let toastEl;
function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.style.cssText = "position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:60;background:rgba(0,0,0,.8);border:1px solid rgba(255,255,255,.15);padding:10px 18px;border-radius:30px;font-weight:600;backdrop-filter:blur(8px);transition:.3s;opacity:0";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg; toastEl.style.opacity = "1";
  clearTimeout(toastEl._t); toastEl._t = setTimeout(() => (toastEl.style.opacity = "0"), 2200);
}

/* ----------------------------- pointer controls ----------------------------- */
function bindPointer() {
  // #fx is pointer-events:none, so listen on the stage and ignore HUD/controls.
  const isControl = (t) => t.closest && t.closest("button, .hud, .modal, .versus-panel, .gallery, input");
  const toCanvas = (e) => {
    const r = els.fx.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * els.fx.width, y: (e.clientY - r.top) / r.height * els.fx.height };
  };
  els.stage.addEventListener("pointerdown", (e) => {
    if (isControl(e.target)) return;
    const p = toCanvas(e);
    state.pointer = { down: true, x: p.x, y: p.y, t: performance.now(), charging: false };
    setTimeout(() => { if (state.pointer.down) { state.pointer.charging = true; hint("Charging cursed energy…"); } }, 220);
  });
  els.stage.addEventListener("pointermove", (e) => {
    if (!state.pointer.down) return;
    const p = toCanvas(e); state.pointer.x = p.x; state.pointer.y = p.y;
  });
  els.stage.addEventListener("pointerup", (e) => {
    if (!state.pointer.down) return;
    const p = toCanvas(e);
    const held = performance.now() - state.pointer.t;
    state.pointer.down = false; state.pointer.charging = false;
    if (held < 260) {
      const now = performance.now();
      if (now - state.lastTap < 300) fireTech("special", p.x, p.y, -Math.PI / 2);
      else fireTech("blast", p.x, p.y, -Math.PI / 2);
      state.lastTap = now;
    }
  });
}

/* ----------------------------- UI wiring ----------------------------- */
function wireUI() {
  document.body.addEventListener("pointerdown", () => audio.unlockAudio(), { once: true });

  document.querySelectorAll(".mode-btn[data-mode]").forEach((b) => {
    b.onclick = () => {
      audio.play("ui");
      const mode = b.dataset.mode;
      if (mode === "ranked") startRanked();
      else if (mode === "versus") { state.ranked = false; ensureCamera().then(() => { versus = newVersus(); openLobby(); }).catch(() => toast("Camera permission needed 📷")); }
      else { state.ranked = false; enterStage("solo"); }
    };
  });

  els.queueClose.onclick = () => { els.queue.classList.add("hidden"); state.ranked = false; if (versus) { versus.close(); versus = null; } };

  els.howToBtn.onclick = () => els.help.classList.remove("hidden");
  els.helpClose.onclick = () => els.help.classList.add("hidden");

  els.backBtn.onclick = leaveStage;
  els.captureBtn.onclick = capture;
  els.domainBtn.onclick = () => fireTech("domain", els.fx.width / 2, els.fx.height * 0.5, -Math.PI / 2);
  els.cloakBtn.onclick = () => { state.cloak = !state.cloak; els.cloakBtn.classList.toggle("active", state.cloak); };
  els.cloakBtn.classList.toggle("active", state.cloak);
  els.mirrorBtn.onclick = () => { state.mirror = !state.mirror; };
  els.soundBtn.onclick = () => {
    audio.setMuted(!audio.muted);
    els.soundBtn.textContent = audio.muted ? "🔇" : "🔊";
    els.soundBtn.classList.toggle("active", !audio.muted);
  };

  // lobby
  els.createRoom.onclick = async () => {
    els.lobbyStatus.textContent = "Creating room…";
    try {
      const code = await versus.host(stream);
      els.codeText.textContent = code;
      els.lobbyCode.classList.remove("hidden");
    } catch (e) { els.lobbyStatus.textContent = "Could not create room: " + e.message; }
  };
  els.joinRoom.onclick = async () => {
    const code = els.roomInput.value.trim().toUpperCase();
    if (code.length < 4) return (els.lobbyStatus.textContent = "Enter the 4-character room code.");
    els.lobbyStatus.textContent = "Joining…";
    try { await versus.join(code, stream); } catch (e) { els.lobbyStatus.textContent = "Could not join: " + e.message; }
  };
  els.copyCode.onclick = () => { navigator.clipboard?.writeText(els.codeText.textContent); toast("Code copied"); };
  els.lobbyClose.onclick = () => { els.lobby.classList.add("hidden"); if (versus) { versus.close(); versus = null; } };

  bindPointer();
}

boot();
