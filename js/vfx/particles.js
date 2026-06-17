// Additive-blended particle system tuned for "cursed energy" looks.
// Glow is done with cached radial sprites (NOT per-particle shadowBlur) so it
// stays fast with hundreds of particles, even on mobile / software rendering.

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

const _spriteCache = new Map();
function hexToRgb(c) {
  let h = (c || "#ffffff").replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}
function glowSprite(color) {
  let s = _spriteCache.get(color);
  if (s) return s;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const [r, gr, b] = hexToRgb(color);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, `rgba(255,255,255,.95)`);
  grd.addColorStop(0.18, `rgba(${r},${gr},${b},.95)`);
  grd.addColorStop(0.5, `rgba(${r},${gr},${b},.45)`);
  grd.addColorStop(1, `rgba(${r},${gr},${b},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  if (_spriteCache.size < 64) _spriteCache.set(color, c);
  return c;
}

export class ParticleSystem {
  constructor(max = 1400) {
    this.max = max;
    this.pool = [];
  }

  spawn(o) {
    if (this.pool.length >= this.max) this.pool.shift();
    this.pool.push({
      x: o.x, y: o.y,
      vx: o.vx || 0, vy: o.vy || 0,
      life: 0, max: o.life || 1,
      size: o.size || 3,
      grow: o.grow || 0,
      drag: o.drag ?? 0.98,
      grav: o.grav || 0,
      color: o.color || "#fff",
      glow: o.glow ?? 1,
      shape: o.shape || "dot",
      angle: o.angle || 0,
      spin: o.spin || 0,
      tx: o.tx, ty: o.ty,          // attraction target
      pull: o.pull || 0,
      fade: o.fade ?? 1,
      additive: o.additive ?? true,
    });
  }

  // converge particles toward a point (Blue / charge)
  implode(x, y, color, glow, n = 26, radius = 220) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), r = rand(radius * 0.4, radius);
      this.spawn({
        x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        tx: x, ty: y, pull: rand(0.05, 0.12),
        life: rand(0.4, 0.8), size: rand(2, 5), color, glow,
        shape: "dot", drag: 0.9,
      });
    }
  }

  burst(x, y, color, glow, n = 40, power = 7, shape = "spark") {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(power * 0.3, power);
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.4, 0.9), size: rand(2, 5), color, glow,
        shape, angle: a, drag: 0.92,
      });
    }
  }

  ring(x, y, color, glow, n = 50, speed = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.spawn({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 0.6, size: 3, color, glow, shape: "spark", angle: a, drag: 0.95,
      });
    }
  }

  stream(x, y, dx, dy, color, glow, n = 6, spread = 0.4) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + rand(-spread, spread);
      const s = Math.hypot(dx, dy) * rand(0.6, 1.2);
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.3, 0.6), size: rand(2, 4), color, glow, shape: "streak",
        angle: a, drag: 0.94,
      });
    }
  }

  // ambient drifting energy near a point (aura)
  aura(x, y, color, glow, n = 2) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      this.spawn({
        x: x + rand(-18, 18), y: y + rand(-18, 18),
        vx: Math.cos(a) * rand(0.4, 1.6), vy: Math.sin(a) * rand(0.4, 1.6) - 1.2,
        life: rand(0.5, 1.1), size: rand(1.5, 3.5), color, glow,
        shape: "dot", drag: 0.95, grav: -0.04,
      });
    }
  }

  shards(x, y, color, glow, n = 16, power = 10) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(power * 0.4, power);
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.5, 1), size: rand(6, 14), color, glow,
        shape: "shard", angle: a, spin: rand(-0.3, 0.3), grav: 0.15, drag: 0.96,
      });
    }
  }

  update(dt) {
    const p = this.pool;
    for (let i = p.length - 1; i >= 0; i--) {
      const o = p[i];
      o.life += dt;
      if (o.life >= o.max) { p.splice(i, 1); continue; }
      if (o.pull && o.tx != null) {
        o.vx += (o.tx - o.x) * o.pull;
        o.vy += (o.ty - o.y) * o.pull;
      }
      o.vy += o.grav;
      o.vx *= o.drag; o.vy *= o.drag;
      o.x += o.vx; o.y += o.vy;
      o.size += o.grow;
      o.angle += o.spin;
    }
  }

  render(ctx) {
    const p = this.pool;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 0;
    for (let i = 0; i < p.length; i++) {
      const o = p[i];
      const t = o.life / o.max;
      ctx.globalAlpha = Math.max(0, 1 - t) * (o.glow >= 0 ? 1 : 1);
      const s = Math.max(0.5, o.size * (1 - t * 0.4));
      switch (o.shape) {
        case "streak": {
          ctx.strokeStyle = o.color; ctx.lineCap = "round"; ctx.lineWidth = s;
          ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x - o.vx * 2.2, o.y - o.vy * 2.2); ctx.stroke();
          break;
        }
        case "spark": {
          const sp = glowSprite(o.color); const d = s * 7;
          ctx.drawImage(sp, o.x - d / 2, o.y - d / 2, d, d);
          ctx.strokeStyle = o.color; ctx.lineWidth = s * 0.6; ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(o.x - Math.cos(o.angle) * s * 2.5, o.y - Math.sin(o.angle) * s * 2.5);
          ctx.lineTo(o.x + Math.cos(o.angle) * s * 2.5, o.y + Math.sin(o.angle) * s * 2.5);
          ctx.stroke();
          break;
        }
        case "shard": {
          ctx.save();
          ctx.translate(o.x, o.y); ctx.rotate(o.angle); ctx.fillStyle = o.color;
          ctx.beginPath();
          ctx.moveTo(0, -s); ctx.lineTo(s * 0.5, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.5, 0);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
        default: {
          const sp = glowSprite(o.color); const d = Math.max(4, s * 6);
          ctx.drawImage(sp, o.x - d / 2, o.y - d / 2, d, d);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  get count() { return this.pool.length; }
  clear() { this.pool.length = 0; }
}

export const helpers = { rand, pick };
