// Recognises hand SIGNS and "commits" them one at a time, like forming jutsu
// signs in sequence. Hold a sign briefly to lock it in, relax, then the next.
import { LM } from "./tracking.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const avg = (pts) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

function features(points, map) {
  const px = points.map(map);
  const wrist = px[LM.WRIST], mMcp = px[LM.MIDDLE_MCP];
  const palmW = Math.max(8, dist(wrist, mMcp));
  const fingerExt = (tip, pip) => dist(px[tip], wrist) > dist(px[pip], wrist) * 1.05;
  const ext = [
    dist(px[LM.THUMB_TIP], px[LM.INDEX_MCP]) > palmW * 0.85,
    fingerExt(LM.INDEX_TIP, LM.INDEX_PIP), fingerExt(LM.MIDDLE_TIP, LM.MIDDLE_PIP),
    fingerExt(LM.RING_TIP, LM.RING_PIP), fingerExt(LM.PINKY_TIP, LM.PINKY_PIP),
  ];
  const count = ext.filter(Boolean).length;
  return { px, palmW, ext, count, center: avg([px[0], px[5], px[9], px[13], px[17]]), open: count >= 4, fist: count <= 1 };
}
function singleSign(h) {
  if (h.fist) return "fist";
  if (h.open) return "open";
  const [, i, m, r, p] = h.ext;
  if (i && !m && !r && !p) return "one";
  if (i && m && !r && !p) return "two";
  return null;
}

const COMMIT_HOLD = 0.32; // hold a sign this long to lock it in
const SMOOTH = 0.45;

export class GestureEngine {
  constructor() { this.holdSign = null; this.holdT = 0; this.committed = false; this.nullT = 0; this.smooth = []; this.window = []; this.lastNow = 0; }

  _smooth(rawHands) {
    if (rawHands.length !== this.smooth.length) this.smooth = rawHands.map((h) => h.points.map((p) => ({ ...p })));
    return rawHands.map((h, i) => {
      const prev = this.smooth[i];
      const pts = h.points.map((p, j) => { const q = prev && prev[j]; if (!q) return { ...p }; q.x += (p.x - q.x) * SMOOTH; q.y += (p.y - q.y) * SMOOTH; q.z = (q.z || 0) + ((p.z || 0) - (q.z || 0)) * SMOOTH; return q; });
      this.smooth[i] = pts; return { points: pts };
    });
  }

  process(result, map, now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastNow) / 1000));
    this.lastNow = now;
    const out = { hands: [], sign: null, progress: 0, commit: null, pos: null };
    const raw = result.hands || [];
    if (!raw.length) { this.holdSign = null; this.holdT = 0; this.committed = false; this.window = []; this.smooth = []; return out; }
    const hands = this._smooth(raw).map((h) => features(h.points, map));
    out.hands = hands; out.pos = hands[0].center;

    // two-hand signs take priority
    let raws = null;
    if (hands.length >= 2) {
      const [a, b] = hands; const d = dist(a.center, b.center) / ((a.palmW + b.palmW) / 2);
      if (a.open && b.open && d < 4) raws = "double"; else if (d < 2.0) raws = "pray";
    }
    if (!raws) raws = singleSign(hands[0]);

    // vote to suppress flicker
    this.window.push(raws); if (this.window.length > 5) this.window.shift();
    const counts = {}; let best = null, bestN = 0;
    for (const s of this.window) { if (!s) continue; counts[s] = (counts[s] || 0) + 1; if (counts[s] > bestN) { bestN = counts[s]; best = s; } }
    const sign = bestN >= 3 ? best : null;
    out.sign = sign;

    if (sign && sign === this.holdSign) { this.holdT += dt; this.nullT = 0; }
    else if (sign == null) { this.nullT += dt; if (this.nullT > 0.14) { this.holdSign = null; this.holdT = 0; this.committed = false; } }
    else { this.holdSign = sign; this.holdT = 0; this.committed = false; this.nullT = 0; }

    if (this.holdSign && !this.committed) {
      out.progress = Math.min(1, this.holdT / COMMIT_HOLD);
      if (this.holdT >= COMMIT_HOLD) { this.committed = true; out.commit = this.holdSign; }
    }
    return out;
  }
}
