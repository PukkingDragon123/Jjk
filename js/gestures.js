// Recognises hand SIGNS from MediaPipe landmarks and casts on a short hold.
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

const CAST_HOLD = 0.42; // seconds to lock a sign

export class GestureEngine {
  constructor() { this.holdSign = null; this.holdT = 0; this.spent = false; this.lastNow = 0; }

  process(result, map, now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastNow) / 1000));
    this.lastNow = now;
    const out = { hands: [], sign: null, progress: 0, cast: null, pos: null, aim: -Math.PI / 2 };
    const hands = (result.hands || []).map((h) => features(h.points, map));
    out.hands = hands;
    if (!hands.length) { this.holdSign = null; this.holdT = 0; this.spent = false; return out; }

    let sign = null, pos = hands[0].center, aim = hands[0].aim;
    if (hands.length >= 2) {
      const [a, b] = hands;
      const d = dist(a.center, b.center) / ((a.palmW + b.palmW) / 2);
      if (a.open && b.open && d < 4) { sign = "double"; pos = avg([a.center, b.center]); }
      else if (d < 2.0) { sign = "pray"; pos = avg([a.center, b.center]); }
    }
    if (!sign) sign = singleSign(hands[0]);
    out.sign = sign; out.pos = pos; out.aim = aim;

    if (sign && sign === this.holdSign) this.holdT += dt;
    else { this.holdSign = sign; this.holdT = 0; this.spent = false; }

    if (sign && !this.spent) out.progress = Math.min(1, this.holdT / CAST_HOLD);
    if (sign && !this.spent && this.holdT >= CAST_HOLD) {
      this.spent = true;
      out.cast = sign;
    }
    return out;
  }
}
