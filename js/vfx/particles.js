// Particle system tuned for a clean cel/anime look:
// - "smoke" = solid puffy circles (source-over) that expand & fade -> cartoon clouds
// - energy dots/sparks use a soft sprite but sparingly, so it never turns to glow soup.

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
const TAU = Math.PI * 2;

const _spriteCache = new Map();
function hexToRgb(c) {
  let h = (c || "#ffffff").replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}
function glowSprite(color) {
  let s = _spriteCache.get(color);
  if (s) return s;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"); const [r, gr, b] = hexToRgb(color);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, `rgba(255,255,255,.95)`);
  grd.addColorStop(0.25, `rgba(${r},${gr},${b},.9)`);
  grd.addColorStop(1, `rgba(${r},${gr},${b},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  if (_spriteCache.size < 96) _spriteCache.set(color, c);
  return c;
}
const _softCache = new Map();
function softSprite(color) {
  let s = _softCache.get(color);
  if (s) return s;
  const c = document.createElement("canvas"); c.width = c.height = 72;
  const g = c.getContext("2d"); const [r, gr, b] = hexToRgb(color);
  const grd = g.createRadialGradient(36, 36, 0, 36, 36, 36);
  grd.addColorStop(0, `rgba(${r},${gr},${b},.92)`);
  grd.addColorStop(0.55, `rgba(${r},${gr},${b},.42)`);
  grd.addColorStop(1, `rgba(${r},${gr},${b},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 72, 72);
  if (_softCache.size < 64) _softCache.set(color, c);
  return c;
}

export class ParticleSystem {
  constructor(max = 1200) { this.max = max; this.pool = []; }

  spawn(o) {
    if (this.pool.length >= this.max) this.pool.shift();
    this.pool.push({
      x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, life: 0, max: o.life || 1,
      size: o.size || 3, grow: o.grow || 0, drag: o.drag ?? 0.98, grav: o.grav || 0,
      color: o.color || "#fff", glow: o.glow ?? 1, shape: o.shape || "dot",
      angle: o.angle || 0, spin: o.spin || 0, tx: o.tx, ty: o.ty, pull: o.pull || 0, alpha: o.alpha ?? 1,
    });
  }

  // ---- anime smoke cloud ----
  puff(x, y, color = "#eef1f6", n = 11, spread = 26, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), r = rand(0, spread);
      this.spawn({
        x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        vx: Math.cos(a) * rand(0.3, 1.6) * power, vy: Math.sin(a) * rand(0.3, 1.6) * power - 0.4,
        life: rand(0.5, 1.0), size: rand(12, 26) * power, grow: rand(0.4, 1.1),
        color, shape: "smoke", drag: 0.9, alpha: rand(0.4, 0.7),
      });
    }
  }

  implode(x, y, color, glow, n = 22, radius = 200) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), r = rand(radius * 0.4, radius);
      this.spawn({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, tx: x, ty: y, pull: rand(0.06, 0.13), life: rand(0.4, 0.8), size: rand(2, 4), color, glow, shape: "dot", drag: 0.9 });
    }
  }
  burst(x, y, color, glow, n = 30, power = 7, shape = "spark") {
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(power * 0.3, power); this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.8), size: rand(2, 4), color, glow, shape, angle: a, drag: 0.92 }); }
  }
  ring(x, y, color, glow, n = 40, speed = 6) {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; this.spawn({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.55, size: 3, color, glow, shape: "spark", angle: a, drag: 0.95 }); }
  }
  stream(x, y, dx, dy, color, glow, n = 6, spread = 0.4) {
    for (let i = 0; i < n; i++) { const a = Math.atan2(dy, dx) + rand(-spread, spread), s = Math.hypot(dx, dy) * rand(0.6, 1.2); this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.55), size: rand(2, 4), color, glow, shape: "streak", angle: a, drag: 0.94 }); }
  }
  aura(x, y, color, glow, n = 2) {
    for (let i = 0; i < n; i++) { const a = rand(0, TAU); this.spawn({ x: x + rand(-16, 16), y: y + rand(-16, 16), vx: Math.cos(a) * rand(0.3, 1.2), vy: Math.sin(a) * rand(0.3, 1.2) - 1, life: rand(0.5, 1), size: rand(1.5, 3), color, glow, shape: "dot", drag: 0.95, grav: -0.04 }); }
  }
  flame(x, y, color, glow = 1.2, n = 3) {
    for (let i = 0; i < n; i++) this.spawn({ x: x + rand(-9, 9), y: y + rand(-4, 6), vx: rand(-0.7, 0.7), vy: rand(-3.4, -1.7), life: rand(0.35, 0.65), size: rand(3, 6), grow: -0.05, color, glow, shape: "dot", drag: 0.9, grav: -0.05 });
  }
  // cursed-energy flame licking off a hand: hot white-ish core + coloured body, rising & flickering
  handFlame(x, y, col, hot, n = 1) {
    for (let i = 0; i < n; i++) {
      const isHot = Math.random() < 0.45;
      this.spawn({ x: x + rand(-4, 4), y: y + rand(-4, 3), vx: rand(-0.5, 0.5), vy: rand(-3.2, -1.7),
        life: rand(0.24, 0.48), size: rand(2, 4.5), grow: rand(-0.12, -0.03), color: isHot ? hot : col, glow: 1.3, shape: "dot", drag: 0.9, grav: -0.06 });
    }
  }
  shards(x, y, color, glow, n = 14, power = 10) {
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(power * 0.4, power); this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.5, 1), size: rand(5, 11), color, glow, shape: "shard", angle: a, spin: rand(-0.3, 0.3), grav: 0.15, drag: 0.96 }); }
  }

  update(dt) {
    const p = this.pool;
    for (let i = p.length - 1; i >= 0; i--) {
      const o = p[i]; o.life += dt;
      if (o.life >= o.max) { p.splice(i, 1); continue; }
      if (o.pull && o.tx != null) { o.vx += (o.tx - o.x) * o.pull; o.vy += (o.ty - o.y) * o.pull; }
      o.vy += o.grav; o.vx *= o.drag; o.vy *= o.drag; o.x += o.vx; o.y += o.vy; o.size += o.grow; o.angle += o.spin;
    }
  }

  render(ctx) {
    const p = this.pool;
    ctx.save();
    for (let i = 0; i < p.length; i++) {
      const o = p[i]; const t = o.life / o.max;
      if (o.shape === "smoke") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = o.alpha * (1 - t) * (1 - t);
        const sp = softSprite(o.color), d = Math.max(2, o.size) * 3.2;
        ctx.drawImage(sp, o.x - d / 2, o.y - d / 2, d, d);
        continue;
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, 1 - t);
      const s = Math.max(0.5, o.size * (1 - t * 0.4));
      if (o.shape === "streak") { ctx.strokeStyle = o.color; ctx.lineCap = "round"; ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x - o.vx * 2.2, o.y - o.vy * 2.2); ctx.stroke(); }
      else if (o.shape === "spark") { const sp = glowSprite(o.color), d = s * 6; ctx.drawImage(sp, o.x - d / 2, o.y - d / 2, d, d); ctx.strokeStyle = o.color; ctx.lineWidth = s * 0.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(o.x - Math.cos(o.angle) * s * 2.2, o.y - Math.sin(o.angle) * s * 2.2); ctx.lineTo(o.x + Math.cos(o.angle) * s * 2.2, o.y + Math.sin(o.angle) * s * 2.2); ctx.stroke(); }
      else if (o.shape === "shard") { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle); ctx.fillStyle = o.color; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.5, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
      else { const sp = glowSprite(o.color), d = Math.max(3, s * 4.5); ctx.drawImage(sp, o.x - d / 2, o.y - d / 2, d, d); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  get count() { return this.pool.length; }
  clear() { this.pool.length = 0; }
}
export const helpers = { rand, pick };
