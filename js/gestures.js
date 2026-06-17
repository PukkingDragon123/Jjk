// Turns MediaPipe hand landmarks into high-level cursed-technique gestures.
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
    dist(px[LM.THUMB_TIP], px[LM.INDEX_MCP]) > palmW * 0.85, // thumb
    fingerExt(LM.INDEX_TIP, LM.INDEX_PIP),
    fingerExt(LM.MIDDLE_TIP, LM.MIDDLE_PIP),
    fingerExt(LM.RING_TIP, LM.RING_PIP),
    fingerExt(LM.PINKY_TIP, LM.PINKY_PIP),
  ];
  const count = ext.filter(Boolean).length;
  const center = avg([px[0], px[5], px[9], px[13], px[17]]);
  const aim = Math.atan2(mMcp.y - wrist.y, mMcp.x - wrist.x);
  return {
    px, palmW, ext, count, center, aim, wrist,
    indexTip: px[LM.INDEX_TIP],
    open: count >= 4,
    fist: count <= 1,
    point: ext[1] && !ext[2] && !ext[3] && !ext[4],
  };
}

export class GestureEngine {
  constructor() {
    this.prev = {};          // handedness -> {center, t}
    this.cool = {};          // action -> ready-at time
    this.specArmed = true;   // two-hand special re-arm
    this.domainHold = 0;     // seconds both hands clasped
    this.lastNow = 0;
  }

  ready(action, now, cd) {
    if ((this.cool[action] || 0) > now) return false;
    this.cool[action] = now + cd;
    return true;
  }

  process(result, map, now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastNow) / 1000));
    this.lastNow = now;
    const out = { charging: false, chargePos: null, events: [], hands: [] };
    const hands = (result.hands || []).map((h) => features(h.points, map));
    out.hands = hands;
    if (!hands.length) { this.domainHold = 0; return out; }

    // velocities (palm-widths per second)
    hands.forEach((h, i) => {
      const k = "h" + i;
      const p = this.prev[k];
      h.speed = p ? dist(h.center, p.center) / h.palmW / dt : 0; // palm-widths / sec
      this.prev[k] = { center: h.center, t: now };
    });

    // ---------- two-hand techniques ----------
    if (hands.length >= 2) {
      const [a, b] = hands;
      const d = dist(a.center, b.center) / ((a.palmW + b.palmW) / 2);
      const mid = avg([a.center, b.center]);
      const aim = Math.atan2(
        Math.sin(a.aim) + Math.sin(b.aim),
        Math.cos(a.aim) + Math.cos(b.aim)
      );
      // SPECIAL: both open, brought close after being apart
      if (d > 5) this.specArmed = true;
      if (a.open && b.open && d < 2.2 && this.specArmed && this.ready("special", now, 1.4)) {
        this.specArmed = false;
        out.events.push({ type: "special", x: mid.x, y: mid.y, aim });
      } else if (a.open && b.open && d < 4) {
        out.charging = true; out.chargePos = mid;
      }
      // DOMAIN: hands clasped (close, not both open) held
      if (d < 2.0 && !(a.open && b.open)) {
        this.domainHold += dt;
        out.chargePos = mid; out.charging = true;
        if (this.domainHold > 0.55 && this.ready("domain", now, 5)) {
          out.events.push({ type: "domain", x: mid.x, y: mid.y, aim: -Math.PI / 2 });
          this.domainHold = -2; // lockout
        }
      } else {
        this.domainHold = Math.max(0, this.domainHold);
        if (d > 2.2) this.domainHold = 0;
      }
    }

    // ---------- single-hand techniques ----------
    for (const h of hands) {
      if (h.open && h.speed < 4) {
        out.charging = true;
        if (!out.chargePos) out.chargePos = h.center;
      }
      // thrust detection
      if (h.speed > 12) {
        if (h.fist && this.ready("melee", now, 0.5)) {
          out.events.push({ type: "melee", x: h.center.x, y: h.center.y, aim: h.aim });
        } else if (h.open && this.ready("blast", now, 0.5)) {
          out.events.push({ type: "blast", x: h.indexTip.x, y: h.indexTip.y, aim: h.aim });
        }
      }
    }
    return out;
  }
}
