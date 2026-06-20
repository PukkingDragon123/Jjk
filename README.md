# JUJUTSU WEB — hand-sign cursed techniques

A camera-based, **Jujutsu Kaisen-inspired** web game. It's a **hand-sign
sequence** game in the spirit of weaving jutsu signs: a technique flashes its
chain of signs, you memorise it, then **perform the signs in order** in front of
your webcam. Every technique you land paints cinematic **cursed-energy VFX** over
the live camera with **AI hand-tracking**. One wrong sign ends the run.

> Fan project. Not affiliated with or endorsed by the official franchise. Made for fun.

---

## ✨ Features

- **Live camera + AI hand tracking** (MediaPipe Hand Landmarker), with a
  **tap-the-signs fallback** so it still works if the camera-AI can't load or
  there's no camera.
- **Six hand signs** — ✋ open palm · ✊ fist · ☝️ one finger · ✌️ two fingers ·
  👐 both palms · 🙏 hands clasped. Hold a sign to lock it, relax, form the next.
- **Cinematic VFX engine** — additive glow particles, anime smoke, slashes,
  beams, Black Flash, full-screen **Domain Expansions**, a downsample **bloom**
  pass, plus a graded/letterboxed camera for a MAPPA-style look.
- **Optional generated clips** — drop `.webm` cursed-energy clips (Higgsfield /
  Runway / Sora …) into `assets/vfx/` and they play automatically over the
  procedural effects. See [`assets/vfx/README.md`](assets/vfx/README.md).
- **4 sorcerers** — Gojo, Sukuna, Yuji, Megumi — each with their own palette and
  five techniques (basic → ultimate → domain).
- **Capture & share** — composite the camera + effects into a framed photo and
  share it (native share sheet on mobile, download on desktop).
- **Cross-play Vs Friend** — duel a friend peer-to-peer over a room code; you see
  each other's camera and land techniques for real damage. Phone ↔ laptop just
  works, all in the browser over WebRTC.

## 🎮 Modes

| Mode | What you do |
|---|---|
| **Technique Trial** | A technique's sign chain flashes, then hides. Recall it and perform it in order. One wrong sign — or running out of time — ends the run. Score and chain combo climb as you go. |
| **Training** | Free practice. The technique book stays on screen; form any technique's signs to unleash it. |
| **Vs Friend** | Cross-play duel over a room code. Complete a technique's signs to land it on your rival. |

No camera? **Tap the sign keys** at the bottom of the screen — same sequences,
works anywhere.

## ▶️ Running it

Camera access needs a secure context, so use a local server (not `file://`):

```bash
# any static server works; e.g.
python3 -m http.server 8099
# then open http://localhost:8099
```

Deploy anywhere that serves static files over **HTTPS** (GitHub Pages, Netlify,
Vercel, githack, …). For **Vs Friend**, both players just need the page open —
the P2P connection runs client-side via [PeerJS](https://peerjs.com/).

## 🖼️ Adding your own character art

See [`assets/README.md`](assets/README.md). Drop `gojo.jpg`, `sukuna.jpg`,
`yuji.jpg`, `megumi.jpg` into `assets/` and refresh — they show up on the
character stickers, the HUD, and your captured photos. Until then, each
sorcerer's initial stands in.

## 🎬 Adding generated technique VFX

See [`assets/vfx/README.md`](assets/vfx/README.md) for the full filename list and
a prompt cheat-sheet. Drop `<characterId>_<techniqueId>.webm` clips in
`assets/vfx/`; they're screen-blended over the camera and fall back to the
built-in procedural effects when missing.

## 🧪 Tests

A headless Playwright smoke test boots the app with a fake camera, plays a Trial
round (correct sequence scores; a wrong sign triggers game-over), opens Training
and the Vs Friend lobby, and fails on any uncaught error:

```bash
python3 -m http.server 8099 &
node test/smoke.mjs
```

## 🛠️ Tech

Vanilla ES modules — **no build step**. MediaPipe Tasks-Vision (hands) and PeerJS
load lazily from CDN; everything else (particles, audio, capture) is hand-rolled.
Sound effects are synthesised with the Web Audio API, so there are no audio asset
files.

```
index.html · css/style.css
js/
  main.js          orchestration, render loop, HUD, clip pipeline
  characters.js    roster + technique sign sequences
  signs.js         the six hand signs
  tracking.js      MediaPipe hands (+ pointer/tap fallback)
  gestures.js      landmarks → committed signs (hold-to-lock)
  vfx/particles.js additive glow-sprite particle system
  vfx/techniques.js scripted effects + Domain Expansions
  multiplayer.js   PeerJS versus (data + media)
  capture.js       photo compositing + share
  audio.js         synthesised SFX
assets/            character art + assets/vfx/ generated clips
```

## ⚠️ Notes & limits

- Hand-tracking quality depends on lighting and your device; the tap controls are
  always available as a fallback.
- Vs Friend uses the public PeerJS broker for signalling — great for casual play,
  but it's not a hardened backend.
