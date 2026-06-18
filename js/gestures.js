// Recognises hand SIGNS from MediaPipe landmarks. Adds landmark smoothing and
// sign "voting" so casting is steady, plus swipe detection for dodging.
import { LM } from "./tracking.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const avg = (pts) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

function features(points, map) {
  const px = points.map(map);
  const wrist = px[LM.WRIST], mMcp = px[LM.MIDDLE_MCP];
  const palmW = Math.max(8, dist(wrist, mMcp));
  const fingerExt = (tip, pip) => dist(px[tip], wrist) > dist(px[pip], wrist) * 1.05;
  const ext = [
    dist(px[LM.THUMB_TIP], px[LM.INDEX_MCP]) > palmW * 0.85,
    fingerExt(LM.INDEX_TIP, LM.INDEX_PIP),
    fingerExt(LM.MIDDLE_TIP, LM.MIDDLE_PIP),
    fingerExt(LM.RING_TIP, LM.RING_PIP),
    fingerExt(LM.PINKY_TIP, LM.PINKY_PIP),
  ];
  const count = ext.filter(Boolean).length;
  const center = avg([px[0], px[5], px[9], px[13], px[17]]);
  const aim = Math.atan2(mMcp.y - wrist.y, mMcp.x - wrist.x);
  return { px, palmW, ext, count, center, aim, open: count >= 4, fist: count <= 1 };
}

function singleSign(h) {
  if (h.fist) return "fist";
  if (h.open) return "open";
  const [, i, m, r, p] = h.ext;
  if (i && !m && !r && !p) return "one";
  if (i && m && !r && !p) return "two";
  return null;
}

const CAST_HOLD = 0.4;      // seconds to lock a sign
const SMOOTH = 0.45;        // landmark EMA (lower = smoother)
const SWIPE_SPEED = 11;     // palm-widths / second for a dodge swipe

export class GestureEngine {
  constructor() {
    this.holdSign = null; this.holdT = 0; this.spent = false; this.nullT = 0;
    this.smooth = []; this.window = []; this.lastNow = 0;
    this.prevCenter = null; this.swipeCool = 0;
  }

  _smoothHands(rawHands) {
    if (rawHands.length !== this.smooth.length) this.smooth = rawHands.map((h) => h.points.map((p) => ({ ...p })));
    return rawHands.map((h, i) => {
      const prev = this.smooth[i];
      const pts = h.points.map((p, j) => {
        const q = prev && prev[j];
        if (!q) return { ...p };
        q.x += (p.x - q.x) * SMOOTH; q.y += (p.y - q.y) * SMOOTH; q.z = (q.z || 0) + ((p.z || 0) - (q.z || 0)) * SMOOTH;
        return q;
      });
      this.smooth[i] = pts;
      return { points: pts };
    });
  }

  process(result, map, now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastNow) / 1000));
    this.lastNow = now;
    this.swipeCool = Math.max(0, this.swipeCool - dt);
    const out = { hands: [], sign: null, progress: 0, cast: null, pos: null, aim: -Math.PI / 2, swipe: false };

    const raw = result.hands || [];
    if (!raw.length) { this.holdSign = null; this.holdT = 0; this.spent = false; this.window = []; this.prevCenter = null; this.smooth = []; return out; }
    const hands = this._smoothHands(raw).map((h) => features(h.points, map));
    out.hands = hands;

    // raw sign this frame (two-hand takes priority)
    let raws = null, pos = hands[0].center, aim = hands[0].aim;
    if (hands.length >= 2) {
      const [a, b] = hands;
      const d = dist(a.center, b.center) / ((a.palmW + b.palmW) / 2);
      if (a.open && b.open && d < 4) { raws = "double"; pos = avg([a.center, b.center]); }
      else if (d < 2.0) { raws = "pray"; pos = avg([a.center, b.center]); }
    }
    if (!raws) raws = singleSign(hands[0]);
    out.pos = pos; out.aim = aim;

    // swipe detection (fast horizontal motion of the lead hand)
    if (this.prevCenter) {
      const vx = (hands[0].center.x - this.prevCenter.x) / hands[0].palmW / dt;
      if (Math.abs(vx) > SWIPE_SPEED && this.swipeCool === 0) { out.swipe = true; this.swipeCool = 0.6; }
    }
    this.prevCenter = hands[0].center;

    // vote over a short window to suppress flicker
    this.window.push(raws); if (this.window.length > 6) this.window.shift();
    const counts = {}; let best = null, bestN = 0;
    for (const s of this.window) { if (!s) continue; counts[s] = (counts[s] || 0) + 1; if (counts[s] > bestN) { bestN = counts[s]; best = s; } }
    const sign = bestN >= 3 ? best : null;
    out.sign = sign;

    // hold-to-cast with brief-null tolerance
    if (sign && sign === this.holdSign) { this.holdT += dt; this.nullT = 0; }
    else if (sign == null) { this.nullT += dt; if (this.nullT > 0.22) { this.holdSign = null; this.holdT = 0; this.spent = false; } }
    else { this.holdSign = sign; this.holdT = 0; this.spent = false; this.nullT = 0; }

    if (this.holdSign && !this.spent) out.progress = Math.min(1, this.holdT / CAST_HOLD);
    if (this.holdSign && !this.spent && this.holdT >= CAST_HOLD) { this.spent = true; out.cast = this.holdSign; }
    return out;
  }
}
