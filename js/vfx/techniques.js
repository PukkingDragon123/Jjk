// Cel/anime-style scripted VFX: smoke-puff explosions, hard shockwave rings,
// white impact-flash frames, crisp slash crescents and speed lines.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (t) => 1 - Math.pow(1 - t, 3);

/* ---- shared anime draw helpers ---- */
function flashCircle(ctx, x, y, r, a) {
  if (r <= 0 || a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "#fff"); g.addColorStop(0.55, "rgba(255,255,255,.85)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
function hardRing(ctx, x, y, r, w, color, a) {
  if (r <= 0 || a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = Math.max(1, w); ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
}
function speedLines(ctx, x, y, r0, r1, n, color, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineCap = "round";
  for (let i = 0; i < n; i++) { const ang = (i / n) * TAU; ctx.lineWidth = rand(1.5, 3.5); ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0); ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1); ctx.stroke(); }
  ctx.restore();
}
function crescent(ctx, x, y, ang, len, thick, color, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(-len, 0); ctx.quadraticCurveTo(0, -thick, len, 0); ctx.quadraticCurveTo(0, -thick * 0.35, -len, 0); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}
function softDisc(ctx, x, y, r, color, a) {
  if (a <= 0 || r <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
function bolt(ctx, x1, y1, x2, y2, color, a, seg) {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1);
  const n = seg || 5; for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(x1 + (x2 - x1) * t + (Math.random() - 0.5) * 28, y1 + (y2 - y1) * t + (Math.random() - 0.5) * 28); }
  ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
// the core anime explosion render (soft shock glow -> white frame -> shockwave rings)
function explosionRender(ctx, x, y, t, dur, color, big) {
  const k = big ? 1.5 : 1, p = t / dur, R = ease(p) * 120 * k;
  softDisc(ctx, x, y, (40 + ease(p) * 130) * k, color, (1 - p) * 0.5);
  if (p < 0.16) flashCircle(ctx, x, y, (1 - p / 0.16) * 74 * k, 1);
  hardRing(ctx, x, y, R, (1 - p) * 7 + 1, "#fff", (1 - p) * 0.9);
  hardRing(ctx, x, y, R * 0.78, (1 - p) * 4 + 1, color, (1 - p) * 0.8);
  if (big && p < 0.32) speedLines(ctx, x, y, 46, 46 + ease(p) * 170, 16, "#fff", 1 - p / 0.32);
}
function explosionSpawn(ps, mgr, x, y, color, big) {
  const k = big ? 1.5 : 1;
  ps.puff(x, y, "#eef2f8", big ? 16 : 11, 26 * k, k);
  ps.puff(x, y, color, big ? 6 : 4, 18 * k, k * 0.8);
  ps.burst(x, y, "#fff", 1.1, big ? 22 : 14, 11 * k, "spark");
  ps.shards(x, y, color, 1, big ? 10 : 6, 9 * k);
  mgr.punchScreen(big ? 20 : 12, color);
}

export class EffectManager {
  constructor(particles) { this.ps = particles; this.fx = []; this.shake = 0; this.flashA = 0; this.flashColor = "#fff"; this.domainActive = false; }
  punchScreen(amount, color) { this.shake = Math.max(this.shake, amount); if (color) { this.flashA = Math.max(this.flashA, 0.3); this.flashColor = color; } }
  trigger(kind, o = {}) { const make = TECH[kind] || TECH.burst; const fx = make(o, this); fx.t = 0; this.fx.push(fx); }
  update(dt) {
    this.shake *= 0.85; this.flashA *= 0.84;
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; f.update(dt, this.ps); if (f.t >= f.dur) { if (f.domain) this.domainActive = false; this.fx.splice(i, 1); } }
  }
  renderUnder(ctx, W, H) { for (const f of this.fx) if (f.under) f.render(ctx, this.ps, W, H); }
  render(ctx, W, H) {
    for (const f of this.fx) if (!f.under) f.render(ctx, this.ps, W, H);
    if (this.flashA > 0.02) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = this.flashA; ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }
}

function beamGeom(o) {
  if (o.incoming) return { ox: o.W * 0.5, oy: -40, aim: Math.atan2(o.H * 0.5 + 40, 0) };
  return { ox: o.x, oy: o.y, aim: o.aim ?? -Math.PI / 2 };
}

const TECH = {
  // generic anime explosion
  burst(o, mgr) {
    const x = o.x, y = o.y, c = o.palette.a, big = !!o.big;
    return {
      dur: 0.62,
      update(dt, ps) {
        if (!this.k) { this.k = true; explosionSpawn(ps, mgr, x, y, c, big); }
        if (o.sub === "double" && !this.k2 && this.t > 0.12) { this.k2 = true; explosionSpawn(ps, mgr, x + rand(-30, 30), y + rand(-20, 20), o.palette.glow || c, big); }
        if (o.sub === "bolt" && !this.b) { this.b = true; for (let i = 0; i < 6; i++) ps.stream(x, y, rand(-12, 12), rand(-20, -4), "#dff0ff", 1.4, 4, 0.1); }
      },
      render(ctx) { explosionRender(ctx, x, y, this.t, this.dur, c, big); },
    };
  },

  // energy projectile -> impact explosion
  orb(o, mgr) {
    const { ox, oy, aim } = beamGeom(o); const speed = 15, L = Math.hypot(o.W, o.H) * 0.6, c = o.palette.a, c2 = o.palette.glow || "#fff";
    let x = ox, y = oy, dist = 0;
    return {
      dur: 1.0,
      update(dt, ps) {
        if (!this.boom) {
          x += Math.cos(aim) * speed; y += Math.sin(aim) * speed; dist += speed;
          if (o.sub === "attract") ps.implode(x, y, c, 1.3, 3, 46);
          if (Math.random() < 0.6) ps.spawn({ x, y, vx: -Math.cos(aim) * 2, vy: -Math.sin(aim) * 2, life: 0.3, size: 3, color: c2, glow: 1.1, shape: "dot", drag: 0.9 });
          if (this.t > 0.5 || dist > L) { this.boom = true; this.bt = this.t; this.bx = x; this.by = y; explosionSpawn(ps, mgr, x, y, c, !!o.big); }
        }
      },
      render(ctx) {
        if (!this.boom) {
          const r = 13 + Math.sin(this.t * 30) * 2;
          flashCircle(ctx, x, y, r * 1.7, 0.85);
          ctx.save(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fill();
          ctx.lineWidth = 4; ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
        } else explosionRender(ctx, this.bx, this.by, this.t - this.bt, this.dur - this.bt, c, !!o.big);
      },
    };
  },

  // clean slash crescent
  slash(o, mgr) {
    const x = o.x, y = o.y, ang = o.aim ?? rand(-0.6, 0.6), len = o.W * 0.42;
    return {
      dur: 0.42,
      update(dt, ps) { if (!this.k) { this.k = true; ps.stream(x, y, Math.cos(ang) * 24, Math.sin(ang) * 24, "#fff", 1.1, 8, 0.12); ps.burst(x, y, o.palette.a, 1.1, 14, 8, "spark"); ps.puff(x, y, "#eef2f8", 4, 16, 0.7); mgr.punchScreen(7, o.palette.a); } },
      render(ctx) { const p = this.t / this.dur; crescent(ctx, x, y, ang, len * (0.7 + 0.3 * ease(p)), 16, o.palette.a, 1 - p); },
    };
  },
  slashBig(o, mgr) {
    const x = o.x, y = o.y, base = o.aim ?? 0, angs = [base - 0.5, base + 0.1, base + 0.6], len = o.W * 0.5;
    return {
      dur: 0.6,
      update(dt, ps) { if (!this.k) { this.k = true; explosionSpawn(ps, mgr, x, y, o.palette.a, !!o.big); mgr.punchScreen(o.big ? 18 : 13, o.palette.a); } },
      render(ctx) { const p = this.t / this.dur; for (let i = 0; i < angs.length; i++) { const pp = Math.max(0, Math.min(1, (this.t - i * 0.06) / (this.dur - i * 0.06))); if (pp <= 0) continue; crescent(ctx, x, y, angs[i], len * (0.7 + 0.3 * ease(pp)), 18, o.palette.a, 1 - pp); } hardRing(ctx, x, y, ease(p) * 110, (1 - p) * 5 + 1, "#fff", (1 - p) * 0.7); },
    };
  },

  // beam (Hollow Purple / Fire Arrow / Max Elephant)
  beam(o, mgr) {
    const { ox, oy, aim } = beamGeom(o); const L = Math.hypot(o.W, o.H) * 1.3;
    const cA = o.warm ? "#ff7b2e" : o.water ? "#39d0ff" : o.palette.a;
    const cB = o.warm ? "#ffd23b" : o.water ? "#eaffff" : o.palette.b;
    const charge = 0.4, fire = 1.0;
    return {
      dur: 1.5,
      update(dt, ps) {
        if (this.t < charge) { ps.implode(ox, oy, cA, 1.4, 8, 160); }
        else if (this.t < fire) {
          if (!this.fired) { this.fired = true; mgr.punchScreen(26, cB); ps.puff(ox, oy, "#eef2f8", 12, 28, 1.3); }
          mgr.shake = Math.max(mgr.shake, 16);
          const ex = ox + Math.cos(aim) * L * 0.62, ey = oy + Math.sin(aim) * L * 0.62;
          if (Math.random() < 0.7) ps.puff(ex, ey, "#eef2f8", 3, 24, 1.2);
          ps.burst(ex, ey, cB, 1.2, 4, 9, "spark");
        }
      },
      render(ctx) {
        if (this.t < charge) { flashCircle(ctx, ox, oy, ease(this.t / charge) * 64 + 8, 0.9); return; }
        const prog = Math.min(1, (this.t - charge) / 0.16), len = ease(prog) * L;
        const ex = ox + Math.cos(aim) * len, ey = oy + Math.sin(aim) * len;
        const fade = this.t > fire ? Math.max(0, 1 - (this.t - fire) / (this.dur - fire)) : 1;
        ctx.save(); ctx.lineCap = "round"; ctx.globalAlpha = fade;
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = cA; ctx.lineWidth = 46; ctx.globalAlpha = fade * 0.4; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = fade;
        ctx.strokeStyle = cB; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = cA; ctx.lineWidth = 64; ctx.globalAlpha = fade * 0.16; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.globalAlpha = fade;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
        if (Math.random() < 0.85) { bolt(ctx, ox, oy, ex, ey, "#fff", fade * 0.5, 9); bolt(ctx, ox, oy, ex, ey, cB, fade * 0.4, 7); }
        flashCircle(ctx, ox, oy, 42 * fade, fade);
        speedLines(ctx, ox, oy, 44, 120, 12, cB, fade * 0.45);
        ctx.restore();
      },
    };
  },

  // shadow beast (Megumi / curse attack)
  beast(o, mgr) {
    const { ox, oy, aim } = beamGeom(o); let x = ox, y = oy; const sp = 16, c = o.palette.a;
    return {
      dur: 0.85,
      update(dt, ps) {
        if (!this.b) {
          x += Math.cos(aim) * sp; y += Math.sin(aim) * sp;
          ps.spawn({ x, y, vx: 0, vy: 0, life: 0.4, size: 16, color: "#0b0d1a", shape: "smoke", alpha: 0.5, grow: 0.6, drag: 0.9 });
          if (this.t > 0.5) { this.b = true; explosionSpawn(ps, mgr, x, y, c, !!o.big); }
        }
      },
      render(ctx) {
        if (this.b) return;
        ctx.save(); ctx.translate(x, y); ctx.rotate(aim);
        ctx.fillStyle = "#0a0c18"; ctx.beginPath(); ctx.ellipse(0, 0, 34, 16, 0, 0, TAU); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = c; ctx.stroke();
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(20, -5, 3, 0, TAU); ctx.arc(20, 5, 3, 0, TAU); ctx.fill();
        ctx.restore();
      },
    };
  },

  // small projectile volley
  nails(o, mgr) {
    const { ox, oy, aim } = beamGeom(o); const n = o.storm ? 16 : 8, c = o.palette.a;
    const nails = Array.from({ length: n }, () => ({ x: ox, y: oy, a: aim + rand(-0.35, 0.35), sp: rand(15, 23), d: rand(0, 0.22), boom: false }));
    return {
      dur: 0.85,
      update(dt, ps) {
        if (!this.k) { this.k = true; mgr.punchScreen(o.storm ? 16 : 8, c); }
        for (const nl of nails) { if (this.t < nl.d) continue; nl.x += Math.cos(nl.a) * nl.sp; nl.y += Math.sin(nl.a) * nl.sp; if (this.t > nl.d + 0.38 && !nl.boom) { nl.boom = true; ps.puff(nl.x, nl.y, "#eef2f8", 4, 14, 0.7); ps.burst(nl.x, nl.y, c, 1.1, 10, 8, "spark"); } }
      },
      render(ctx) { ctx.save(); ctx.globalCompositeOperation = "lighter"; for (const nl of nails) { if (this.t < nl.d || nl.boom) continue; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(nl.x, nl.y); ctx.lineTo(nl.x - Math.cos(nl.a) * 16, nl.y - Math.sin(nl.a) * 16); ctx.stroke(); } ctx.restore(); },
    };
  },

  // BLACK FLASH — bold impact frame
  flash(o, mgr) {
    const x = o.x, y = o.y, reps = o.barrage ? 4 : 1;
    return {
      dur: o.barrage ? 1.2 : 0.7,
      update(dt, ps) {
        const step = this.dur / reps, idx = Math.floor(this.t / step);
        if (idx > (this.last ?? -1) && idx < reps) {
          this.last = idx;
          const px = o.barrage ? x + rand(-120, 120) : x, py = o.barrage ? y + rand(-90, 90) : y;
          this.px = px; this.py = py; this.flick = this.t;
          ps.burst(px, py, "#ff2f3f", 1.4, 30, 13, "spark"); ps.shards(px, py, "#101018", 0, 16, 12); ps.puff(px, py, "#1a1020", 6, 18, 1);
          mgr.punchScreen(24, "#ff2f3f");
        }
      },
      render(ctx) {
        if (this.flick == null) return; const dt = this.t - this.flick; if (dt > 0.26) return;
        const a = 1 - dt / 0.26, R = ease(dt / 0.26) * 130;
        // black core ring + red ring (the signature black flash)
        hardRing(ctx, this.px, this.py, R, (1 - a) * 2 + 10, "#0a0a12", a);
        hardRing(ctx, this.px, this.py, R, (1 - a) * 2 + 4, "#ff2f3f", a);
        softDisc(ctx, this.px, this.py, 96 * a, "#ff2f3f", a * 0.55);
        flashCircle(ctx, this.px, this.py, 70 * a, a);
        speedLines(ctx, this.px, this.py, 30, 150, 14, "#ff2f3f", a * 0.8);
        for (let i = 0; i < 5; i++) { const ang = Math.random() * TAU; bolt(ctx, this.px, this.py, this.px + Math.cos(ang) * 130, this.py + Math.sin(ang) * 130, "#ff5a66", a * 0.8, 5); }
      },
    };
  },

  // cursed flames (blue when palette is blue)
  flame(o, mgr) {
    const { ox, oy, aim } = beamGeom(o);
    const cool = o.warm ? "#ff7b2e" : o.palette.a, hot = o.warm ? "#ffd23b" : (o.palette.glow || "#dff0ff");
    let x = ox, y = oy; const sp = 12, L = Math.hypot(o.W, o.H) * 0.5; let dist = 0;
    return {
      dur: 0.85,
      update(dt, ps) {
        if (!this.lit) { this.lit = true; mgr.punchScreen(7, hot); }
        if (dist < L && this.t < 0.42) {
          x += Math.cos(aim) * sp; y += Math.sin(aim) * sp; dist += sp;
          for (let i = 0; i < 4; i++) ps.flame(x, y, Math.random() < 0.5 ? cool : hot, 1.3, 1);
          ps.puff(x, y, "#3a2a30", 1, 12, 0.6);
        } else if (!this.boom) { this.boom = true; explosionSpawn(ps, mgr, x, y, cool, false); }
      },
      render(ctx) { if (this.boom || dist < 6) return; flashCircle(ctx, x, y, 26, 0.8); },
    };
  },

  guard(o, mgr) {
    const x = o.x, y = o.y, c = o.palette.glow || o.palette.a;
    return {
      dur: 1.0,
      update(dt, ps) { if (!this.k) { this.k = true; ps.ring(x, y, c, 1.2, 30, 5); mgr.punchScreen(5, c); } },
      render(ctx) { const t = this.t / this.dur, R = 70 + ease(t) * 56, a = 1 - t; ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = 3; for (let ring = 0; ring < 2; ring++) { const rr = R - ring * 22; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const ang = i / 6 * TAU + this.t * (ring ? -1.4 : 1.4), px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); } ctx.restore(); },
    };
  },
  parry(o, mgr) {
    const x = o.x, y = o.y, c = o.palette.glow || "#fff";
    return {
      dur: 0.5,
      update(dt, ps) { if (!this.k) { this.k = true; ps.ring(x, y, "#fff", 1.4, 40, 9); ps.burst(x, y, c, 1.3, 22, 10, "spark"); ps.puff(x, y, "#eef2f8", 6, 18, 1); mgr.punchScreen(14, "#fff"); } },
      render(ctx) { const t = this.t / this.dur, a = 1 - t, R = ease(t) * 110; hardRing(ctx, x, y, R, a * 5 + 1, "#fff", a); ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * R * 0.5, y + Math.sin(ang) * R * 0.5); ctx.lineTo(x + Math.cos(ang) * R, y + Math.sin(ang) * R); ctx.stroke(); } ctx.restore(); },
    };
  },

  // DOMAIN EXPANSION
  domain(o, mgr) {
    mgr.domainActive = true;
    const style = o.style, W = o.W, H = o.H, cx = W / 2, cy = H / 2, MAX = Math.hypot(W, H);
    const stars = Array.from({ length: 150 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(0.5, 2.6), p: rand(0, TAU) }));
    const slashes = Array.from({ length: 40 }, () => ({ x: rand(0, W), y: rand(0, H), a: rand(-1, 1), l: rand(80, 280), d: rand(0, 2.0) }));
    const eyes = Array.from({ length: 14 }, () => ({ x: rand(W * 0.08, W * 0.92), y: rand(H * 0.1, H * 0.9), p: rand(0, TAU) }));
    const ACC = style === "shrine" ? "#ff2230" : style === "shadow" ? "#7c8bff" : "#6ec3ff";
    return {
      dur: 3.0, under: true, domain: true,
      update(dt, ps) {
        if (!this.k) { this.k = true; mgr.punchScreen(34, "#fff"); }
        mgr.shake = Math.max(mgr.shake, 7 * Math.max(0, 1 - this.t / this.dur));
        if (!this.hit && this.t > 0.7) { this.hit = true; mgr.punchScreen(20, ACC); ps.ring(cx, cy, "#fff", 1.6, 70, 12); }
        if (style === "shrine" && Math.random() < 0.6) ps.stream(rand(0, W), rand(0, H), rand(-26, 26), rand(-26, 26), "#fff", 1.2, 3, 0.1);
      },
      render(ctx, ps, W, H) {
        const inT = Math.min(1, this.t / 0.45), outT = this.t > this.dur - 0.6 ? (this.dur - this.t) / 0.6 : 1, a = Math.min(inT, outT), rot = this.t * 0.4;
        ctx.save();
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, MAX * 0.62);
        if (style === "void") { bg.addColorStop(0, "#241552"); bg.addColorStop(0.55, "#0a0524"); bg.addColorStop(1, "#000"); }
        else if (style === "shrine") { bg.addColorStop(0, "#360608"); bg.addColorStop(0.6, "#140103"); bg.addColorStop(1, "#000"); }
        else { bg.addColorStop(0, "#0d1030"); bg.addColorStop(0.6, "#04060f"); bg.addColorStop(1, "#000"); }
        ctx.globalAlpha = a * 0.94; ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a * 0.16; ctx.fillStyle = ACC;
        for (let i = 0; i < 28; i++) { const ang = i / 28 * TAU + rot; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang - 0.04) * MAX, cy + Math.sin(ang - 0.04) * MAX); ctx.lineTo(cx + Math.cos(ang + 0.04) * MAX, cy + Math.sin(ang + 0.04) * MAX); ctx.closePath(); ctx.fill(); }
        if (style === "void") {
          for (const s of stars) { const tw = 0.5 + 0.5 * Math.sin(this.t * 4 + s.p); ctx.globalAlpha = a * tw; ctx.fillStyle = "#cfe0ff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.s * 1.6, 0, TAU); ctx.fill(); }
          ctx.globalAlpha = a * 0.5; ctx.strokeStyle = "#6ec3ff"; ctx.lineWidth = 1;
          for (let i = 0; i < stars.length; i += 3) { const s1 = stars[i], s2 = stars[(i + 7) % stars.length]; if (Math.hypot(s1.x - s2.x, s1.y - s2.y) < 170) { ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke(); } }
          ctx.globalAlpha = a * 0.6; ctx.strokeStyle = "#bfe3ff"; ctx.lineWidth = 2;
          for (let r = 1; r <= 4; r++) { ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.09 * r, 0, TAU); ctx.stroke(); }
        } else if (style === "shrine") {
          ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = a * 0.85; ctx.fillStyle = "#0a0203"; ctx.strokeStyle = "#ff2230"; ctx.lineWidth = 3;
          const tw = W * 0.5, th = H * 0.5, tx = cx, ty = cy + H * 0.12;
          ctx.fillRect(tx - tw / 2 - 14, ty - th, 22, th); ctx.fillRect(tx + tw / 2 - 8, ty - th, 22, th);
          ctx.fillRect(tx - tw / 2 - 40, ty - th - 6, tw + 80, 26); ctx.fillRect(tx - tw / 2 - 28, ty - th + 28, tw + 56, 16);
          ctx.globalCompositeOperation = "lighter";
          for (const s of slashes) { if (this.t < s.d) continue; const sa = Math.max(0, 1 - (this.t - s.d) / 0.6) * a; ctx.globalAlpha = sa; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(s.a) * s.l, s.y + Math.sin(s.a) * s.l); ctx.stroke(); }
        } else {
          for (let r = 0; r < 5; r++) { ctx.globalAlpha = a * 0.18; ctx.strokeStyle = "#7c8bff"; ctx.lineWidth = 2; const rr = ((this.t * 120 + r * 90) % (MAX * 0.6)); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); }
          ctx.fillStyle = "#cdd4ff";
          for (const e of eyes) { const blink = Math.sin(this.t * 2 + e.p) > -0.8 ? 1 : 0.15; ctx.globalAlpha = a * blink; ctx.beginPath(); ctx.ellipse(e.x, e.y, 7, 4, 0, 0, TAU); ctx.ellipse(e.x + 18, e.y, 7, 4, 0, 0, TAU); ctx.fill(); }
        }
        if (this.t < 0.7) { const rr = ease(this.t / 0.7) * MAX * 0.6; ctx.globalAlpha = (1 - this.t / 0.7) * a; ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); }
        ctx.restore();
      },
    };
  },
};
