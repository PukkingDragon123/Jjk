# 呪術 · JUJUTSU WEB

A camera-based, **Jujutsu Kaisen-inspired** web toy. Point your webcam at
yourself, channel **cursed energy** with your hands, and unleash techniques —
Gojo's **Hollow Purple**, Sukuna's **Cleave / Malevolent Shrine**, Yuji's
**Black Flash**, Megumi's **Divine Dogs** — as glowing VFX painted over the live
camera with **AI hand-tracking**. Snap stylised cursed photos, or **fight other
people** in real time (room-code or ranked matchmaking), cross-play, in the
browser.

> Fan project. Not affiliated with or endorsed by the official franchise. Made for fun.

---

## ✨ Features

- **Live camera + AI hand tracking** (MediaPipe Hand Landmarker), with a
  **pointer/tap fallback** so it still works if the camera-AI can't load.
- **Cursed-energy VFX engine** — additive particle system, beams, slashes,
  Black Flash, and full-screen **Domain Expansions** (Unlimited Void,
  Malevolent Shrine, Chimera Shadow Garden).
- **Gesture techniques** — charge, blast, melee, two-hand specials, and domains
  triggered by what your hands actually do.
- **5… er, 4 sorcerers** — Gojo, Sukuna, Yuji, Megumi — each with their own
  palette, techniques, and domain.
- **Capture & post** — composite the camera + effects into a framed photo and
  share it (native share sheet on mobile, download on desktop).
- **Versus (room code)** — battle a friend peer-to-peer; you see each other's
  camera and land techniques for real damage.
- **Ranked** — auto-matchmaking + sorcerer **grades** (Grade 4 → Special Grade)
  that you climb by winning. Progress is saved locally.
- **Cross-play** — it's all in the browser over WebRTC, so phone ↔ laptop ↔
  tablet across platforms just works.

## 🎮 How to play

| Gesture | Action |
|---|---|
| ✋ Hold an open palm steady | **Charge** cursed energy |
| 👉 Thrust an open palm | **Blast** (your character's projectile) |
| ✊ Fast punch (fist) | **Melee** (e.g. Black Flash) |
| 🙌 Bring both hands together | **Special** (Hollow Purple, Fire Arrow…) |
| 🛐 Clasp both hands & hold (energy full) | **Domain Expansion** |
| 👆 Tap / double-tap / hold the screen | Blast / Special / Charge (always works) |

The **◉** button captures a photo. **領域展開** triggers your Domain when the
energy bar is full. Toggles: cursed cloak, sound, mirror.

## ▶️ Running it

Camera access needs a secure context, so use a local server (not `file://`):

```bash
# any static server works; e.g.
python3 -m http.server 8099
# then open http://localhost:8099
```

Deploy anywhere that serves static files over **HTTPS** (GitHub Pages, Netlify,
Vercel, …). For **Versus/Ranked**, both players just need the page open —
matchmaking and the P2P connection run client-side via
[PeerJS](https://peerjs.com/).

## 🖼️ Adding your own character art

See [`assets/README.md`](assets/README.md). Drop `gojo.png`, `sukuna.png`,
`yuji.png`, `megumi.png` into `assets/` and refresh — they show up on the
character stickers, the HUD, and your captured photos. Until then, a stencil
kanji stands in.

## 🧪 Tests

A headless Playwright smoke test boots the app with a fake camera, exercises
solo / ranked / versus, and fails on any uncaught error:

```bash
python3 -m http.server 8099 &
node test/smoke.mjs
```

## 🛠️ Tech

Vanilla ES modules — **no build step**. MediaPipe Tasks-Vision (hands) and
PeerJS load lazily from CDN; everything else (particles, audio, capture, ranking)
is hand-rolled. Sound effects are synthesised with the Web Audio API, so there
are no audio asset files.

```
index.html · css/style.css
js/
  main.js          orchestration, render loop, HUD
  characters.js    roster + technique mappings
  tracking.js      MediaPipe hands (+ pointer fallback)
  gestures.js      landmarks → technique gestures
  vfx/particles.js additive glow-sprite particle system
  vfx/techniques.js scripted effects + Domain Expansions
  multiplayer.js   PeerJS versus + ranked matchmaking
  rank.js          grades / progression (localStorage)
  capture.js       photo compositing + share
  audio.js         synthesised SFX
```

## ⚠️ Notes & limits

- Hand-tracking quality depends on lighting and your device; the tap controls
  are always available as a fallback.
- Ranked matchmaking is **serverless** (a shared rendezvous over the public
  PeerJS broker) — great for casual play, but it's not a hardened ranked
  backend, and the rating is stored on your own device.
