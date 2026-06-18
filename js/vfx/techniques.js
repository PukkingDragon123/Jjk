// Timed, scripted VFX (orbs, beams, slashes, Black Flash, Domain Expansions).
// Each effect: { t, dur, update(dt,sys), render(ctx,sys,W,H) }.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (t) => 1 - Math.pow(1 - t, 3);

function lerpColor(c1, c2, t) {
  const a = hex(c1), b = hex(c2);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function hex(c) {
  const m = c.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

export class EffectManager {
  constructor(particles) {
    this.ps = particles;
    this.fx = [];
    this.shake = 0;
    this.flashA = 0;
    this.flashColor = "#fff";
    this.domainActive = false;
  }

  punchScreen(amount, color) {
    this.shake = Math.max(this.shake, amount);
    if (color) { this.flashA = Math.max(this.flashA, 0.5); this.flashColor = color; }
  }

  trigger(kind, o = {}) {
    const make = TECH[kind] || TECH.burst;
    const fx = make(o, this);
    fx.t = 0;
    this.fx.push(fx);
  }

  update(dt) {
    this.shake *= 0.86;
    this.flashA *= 0.86;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      f.update(dt, this.ps);
      if (f.t >= f.dur) {
        if (f.domain) this.domainActive = false;
        this.fx.splice(i, 1);
      }
    }
  }

  renderUnder(ctx, W, H) {
    // domain backgrounds render under particles
    for (const f of this.fx) if (f.under) f.render(ctx, this.ps, W, H);
  }
  render(ctx, W, H) {
    for (const f of this.fx) if (!f.under) f.render(ctx, this.ps, W, H);
    if (this.flashA > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

function beamGeom(o) {
  // origin + aim angle; if incoming, come from top edge toward center
  if (o.incoming) {
    return { ox: o.W * 0.5, oy: -40, aim: Math.atan2(o.H * 0.5 + 40, 0) };
  }
  return { ox: o.x, oy: o.y, aim: o.aim ?? -Math.PI / 2 };
}

const TECH = {
  // ---- projectile orb (Blue, etc.) ----
  orb(o, mgr) {
    const { ox, oy, aim } = beamGeom(o);
    const speed = 14, len = Math.hypot(o.W, o.H);
    const c = o.palette.a, c2 = o.palette.glow;
    let x = ox, y = oy, dist = 0;
    return {
      dur: 1.1,
      update(dt, ps) {
        x += Math.cos(aim) * speed; y += Math.sin(aim) * speed; dist += speed;
        if (o.sub === "attract") ps.implode(x, y, c, 1.4, 4, 60);
        ps.aura(x, y, c2, 1.2, 3);
        ps.stream(x, y, -Math.cos(aim) * 6, -Math.sin(aim) * 6, c, 1, 3, 0.3);
        if (this.t > 0.55 && !this.boomed) { this.boomed = true; ps.burst(x, y, c, 1.6, 60, 11, "spark"); ps.shards(x, y, c2, 1.2, 10, 9); mgr.punchScreen(8, c); }
      },
      render(ctx) {
        if (this.boomed) return;
        const r = 16 + Math.sin(this.t * 30) * 3;
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
        g.addColorStop(0, "#fff"); g.addColorStop(0.3, c2); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
        ctx.restore();
      },
    };
  },

  // ---- big beam (Hollow Purple, Fire Arrow, Max Elephant) ----
  beam(o, mgr) {
    const { ox, oy, aim } = beamGeom(o);
    const L = Math.hypot(o.W, o.H) * 1.3;
    const cA = o.warm ? "#ff7b2e" : o.water ? "#39d0ff" : o.palette.a;
    const cB = o.warm ? "#ffd23b" : o.water ? "#eaffff" : o.palette.b;
    const charge = 0.42, fire = 1.0;
    return {
      dur: 1.5,
      update(dt, ps) {
        if (this.t < charge) {
          ps.implode(ox, oy, cA, 1.6, 10, 180);
          ps.implode(ox, oy, cB, 1.4, 6, 140);
          if (!this.lit) { this.lit = true; }
        } else if (this.t < fire) {
          if (!this.fired) { this.fired = true; mgr.punchScreen(26, cB); }
          mgr.shake = Math.max(mgr.shake, 18);
          const ex = ox + Math.cos(aim) * L, ey = oy + Math.sin(aim) * L;
          for (let i = 0; i < 6; i++) {
            const p = Math.random();
            ps.burst(ox + (ex - ox) * p, oy + (ey - oy) * p, p < 0.5 ? cA : cB, 1.5, 4, 9, "streak");
          }
          ps.burst(ex, ey, cB, 1.6, 8, 12);
        }
      },
      render(ctx, ps, W, H) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        if (this.t < charge) {
          const r = ease(this.t / charge) * 60 + 8;
          const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
          g.addColorStop(0, "#fff"); g.addColorStop(0.5, cB); g.addColorStop(1, cA + "00");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.fill();
        } else {
          const prog = Math.min(1, (this.t - charge) / 0.18);
          const len = ease(prog) * L;
          const ex = ox + Math.cos(aim) * len, ey = oy + Math.sin(aim) * len;
          const fade = this.t > fire ? Math.max(0, 1 - (this.t - fire) / (this.dur - fire)) : 1;
          ctx.globalAlpha = fade;
          const widths = [70, 40, 18, 7];
          const cols = [cA + "55", cA, cB, "#ffffff"];
          for (let i = 0; i < widths.length; i++) {
            ctx.strokeStyle = cols[i]; ctx.lineWidth = widths[i];
            ctx.lineCap = "round"; ctx.shadowColor = cB; ctx.shadowBlur = 40;
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
          }
          // muzzle
          const mg = ctx.createRadialGradient(ox, oy, 0, ox, oy, 90);
          mg.addColorStop(0, "#fff"); mg.addColorStop(0.4, cB); mg.addColorStop(1, "transparent");
          ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(ox, oy, 90, 0, TAU); ctx.fill();
        }
        ctx.restore();
      },
    };
  },

  // ---- slash (Dismantle / Cleave) ----
  slash(o, mgr) {
    const x = o.x, y = o.y;
    const ang = o.aim ?? rand(-0.6, 0.6);
    const len = (o.W) * 0.5;
    return {
      dur: 0.5,
      update(dt, ps) {
        if (!this.done) {
          this.done = true;
          ps.stream(x, y, Math.cos(ang) * 30, Math.sin(ang) * 30, "#fff", 1.4, 12, 0.15);
          ps.burst(x, y, o.palette.a, 1.4, 24, 9, "spark");
          mgr.punchScreen(7);
        }
      },
      render(ctx) {
        const a = Math.max(0, 1 - this.t / this.dur);
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
        ctx.translate(x, y); ctx.rotate(ang);
        ctx.shadowColor = "#fff"; ctx.shadowBlur = 24;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(-len, -1.5); ctx.quadraticCurveTo(0, -10, len, -1.5);
        ctx.quadraticCurveTo(0, 10, -len, -1.5); ctx.fill();
        ctx.restore();
      },
    };
  },

  slashBig(o, mgr) {
    const sub = [];
    for (let i = 0; i < 4; i++) {
      sub.push(TECH.slash({ ...o, aim: (i - 1.5) * 0.5 + rand(-0.1, 0.1) }, mgr));
    }
    return {
      dur: 0.7,
      update(dt, ps) {
        if (!this.k) { this.k = true; mgr.punchScreen(14, o.palette.a); }
        sub.forEach((s) => { s.t = this.t; s.update(dt, ps); });
      },
      render(ctx, ps, W, H) { sub.forEach((s) => s.render(ctx, ps, W, H)); },
    };
  },

  // ---- burst (Red / Divergent Fist / Hammer) ----
  burst(o, mgr) {
    const x = o.x, y = o.y, c = o.palette.a, c2 = o.palette.glow;
    const big = o.big ? 1.7 : 1;
    return {
      dur: 0.8,
      update(dt, ps) {
        if (!this.done) {
          this.done = true;
          ps.ring(x, y, c, 1.5, 60, 9 * big);
          ps.burst(x, y, c2, 1.4, 50 * big, 12 * big, "spark");
          ps.shards(x, y, c, 1.2, 14 * big, 11 * big);
          mgr.punchScreen(o.sub === "double" ? 16 : 12, c);
          if (o.sub === "double") setTimeout(() => { ps.burst(x, y, c2, 1.6, 40, 14, "spark"); mgr.punchScreen(14, c2); }, 90);
          if (o.sub === "bolt") for (let i = 0; i < 6; i++) ps.stream(x, y, rand(-12, 12), rand(-18, -4), "#cfe6ff", 1.6, 4, 0.1);
        }
      },
      render(ctx) {
        const t = this.t / this.dur, r = ease(t) * 120 * big;
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - t) * 0.8;
        ctx.strokeStyle = c2; ctx.lineWidth = 6 * (1 - t) + 1; ctx.shadowColor = c; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        ctx.restore();
      },
    };
  },

  // ---- shadow beast (Megumi) ----
  beast(o, mgr) {
    const { ox, oy, aim } = beamGeom(o);
    let x = ox, y = oy; const sp = 16;
    return {
      dur: 0.9,
      update(dt, ps) {
        x += Math.cos(aim) * sp; y += Math.sin(aim) * sp;
        ps.stream(x, y, -Math.cos(aim) * 8, -Math.sin(aim) * 8, o.palette.b, 0.8, 5, 0.5);
        ps.aura(x, y, o.palette.a, 1, 2);
        if (this.t > 0.5 && !this.b) { this.b = true; ps.burst(x, y, o.palette.a, 1.3, 36, 9); mgr.punchScreen(9, o.palette.a); }
      },
      render(ctx) {
        if (this.b) return;
        ctx.save(); ctx.translate(x, y); ctx.rotate(aim);
        ctx.fillStyle = "#0a0d22"; ctx.shadowColor = o.palette.a; ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.ellipse(0, 0, 34, 16, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = o.palette.glow; // eyes
        ctx.beginPath(); ctx.arc(18, -5, 3, 0, TAU); ctx.arc(18, 5, 3, 0, TAU); ctx.fill();
        ctx.restore();
      },
    };
  },

  // ---- nails (Nobara) ----
  nails(o, mgr) {
    const { ox, oy, aim } = beamGeom(o);
    const n = o.storm ? 22 : 9;
    const nails = Array.from({ length: n }, (_, i) => ({
      x: ox, y: oy, a: aim + rand(-0.35, 0.35), sp: rand(16, 24), d: rand(0, 0.25), boom: false,
    }));
    return {
      dur: 0.9,
      update(dt, ps) {
        if (!this.k) { this.k = true; mgr.punchScreen(o.storm ? 18 : 8, o.palette.a); }
        for (const nl of nails) {
          if (this.t < nl.d) continue;
          nl.x += Math.cos(nl.a) * nl.sp; nl.y += Math.sin(nl.a) * nl.sp;
          ps.stream(nl.x, nl.y, -Math.cos(nl.a) * 4, -Math.sin(nl.a) * 4, o.palette.a, 1, 1, 0.05);
          if (this.t > nl.d + 0.4 && !nl.boom) { nl.boom = true; ps.burst(nl.x, nl.y, o.palette.glow, 1.3, 16, 8, "spark"); }
        }
      },
      render(ctx) {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (const nl of nails) {
          if (this.t < nl.d || nl.boom) continue;
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.shadowColor = o.palette.a; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.moveTo(nl.x, nl.y); ctx.lineTo(nl.x - Math.cos(nl.a) * 16, nl.y - Math.sin(nl.a) * 16); ctx.stroke();
        }
        ctx.restore();
      },
    };
  },

  // ---- BLACK FLASH (Yuji) ----
  flash(o, mgr) {
    const x = o.x, y = o.y;
    const reps = o.barrage ? 4 : 1;
    return {
      dur: o.barrage ? 1.2 : 0.7,
      update(dt, ps) {
        const step = this.dur / reps;
        const idx = Math.floor(this.t / step);
        if (idx > (this.last ?? -1) && idx < reps) {
          this.last = idx;
          const px = o.barrage ? x + rand(-120, 120) : x;
          const py = o.barrage ? y + rand(-90, 90) : y;
          this.px = px; this.py = py; this.flick = this.t;
          ps.burst(px, py, "#ff2230", 1.6, 50, 14, "spark");
          ps.burst(px, py, "#101014", 0, 30, 11, "shard");
          ps.shards(px, py, "#ff4040", 1.4, 16, 13);
          mgr.punchScreen(24, "#ff2230");
        }
      },
      render(ctx, ps, W, H) {
        if (this.flick == null) return;
        const dt = this.t - this.flick;
        if (dt > 0.25) return;
        const a = Math.max(0, 1 - dt / 0.25);
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
        // electric red cracks
        ctx.strokeStyle = "#ff2f3f"; ctx.shadowColor = "#ff2f3f"; ctx.shadowBlur = 30;
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * TAU + dt;
          ctx.lineWidth = rand(1, 4); ctx.beginPath(); ctx.moveTo(this.px, this.py);
          let cx = this.px, cy = this.py;
          for (let j = 0; j < 4; j++) { cx += Math.cos(ang) * rand(20, 50) + rand(-15, 15); cy += Math.sin(ang) * rand(20, 50) + rand(-15, 15); ctx.lineTo(cx, cy); }
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(this.px, this.py, 0, this.px, this.py, 70);
        g.addColorStop(0, "#fff"); g.addColorStop(0.4, "#ff2f3f"); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.px, this.py, 70, 0, TAU); ctx.fill();
        ctx.restore();
      },
    };
  },

  // ---- cursed flames (blue flame when palette is blue) ----
  flame(o, mgr) {
    const { ox, oy, aim } = beamGeom(o);
    const cool = o.warm ? "#ff7b2e" : (o.palette.a);
    const hot = o.warm ? "#ffd23b" : (o.palette.glow || "#cfeaff");
    let x = ox, y = oy; const sp = 11, L = Math.hypot(o.W, o.H) * 0.5; let dist = 0;
    return {
      dur: 0.9,
      update(dt, ps) {
        if (!this.lit) { this.lit = true; mgr.punchScreen(7, hot); }
        if (dist < L && this.t < 0.45) {
          x += Math.cos(aim) * sp; y += Math.sin(aim) * sp; dist += sp;
          for (let i = 0; i < 5; i++) { ps.flame(x, y, Math.random() < 0.5 ? cool : hot, 1.4, 1); }
          ps.spawn({ x, y, vx: Math.cos(aim) * 2, vy: Math.sin(aim) * 2, life: 0.3, size: 7, color: "#fff", glow: 1.6, shape: "dot", drag: 0.85 });
        } else if (!this.boomed) { this.boomed = true; ps.burst(x, y, hot, 1.6, 40, 9); ps.ring(x, y, cool, 1.3, 30, 6); mgr.punchScreen(9, hot); }
      },
      render(ctx) {
        if (this.boomed || dist < 6) return;
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(x, y, 0, x, y, 34);
        g.addColorStop(0, "#fff"); g.addColorStop(0.35, hot); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
        ctx.restore();
      },
    };
  },

  // ---- counter / parry flash ----
  parry(o, mgr) {
    const x = o.x, y = o.y, c = o.palette.glow || "#cfeaff";
    return {
      dur: 0.5,
      update(dt, ps) { if (!this.k) { this.k = true; ps.ring(x, y, "#fff", 1.6, 40, 9); ps.burst(x, y, c, 1.5, 28, 10, "spark"); mgr.punchScreen(14, "#fff"); } },
      render(ctx) {
        const t = this.t / this.dur, a = Math.max(0, 1 - t), R = ease(t) * 110;
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 5 * a + 1; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = c;
        for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * R * 0.5, y + Math.sin(ang) * R * 0.5); ctx.lineTo(x + Math.cos(ang) * R, y + Math.sin(ang) * R); ctx.stroke(); }
        ctx.restore();
      },
    };
  },

  // ---- guard / shield (Infinity) ----
  guard(o, mgr) {
    const x = o.x, y = o.y, c = o.palette.a, c2 = o.palette.glow;
    return {
      dur: 1.0,
      update(dt, ps) { if (!this.k) { this.k = true; ps.ring(x, y, c2, 1.2, 36, 5); mgr.punchScreen(5, c2); } },
      render(ctx) {
        const t = this.t / this.dur, R = 70 + ease(t) * 60, a = Math.max(0, 1 - t);
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
        ctx.strokeStyle = c2; ctx.lineWidth = 3;
        for (let ring = 0; ring < 2; ring++) {
          const rr = R - ring * 22;
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) { const ang = i / 6 * TAU + this.t * (ring ? -1.5 : 1.5); const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.closePath(); ctx.stroke();
        }
        ctx.restore();
      },
    };
  },

  // ---- DOMAIN EXPANSION ----
  domain(o, mgr) {
    mgr.domainActive = true;
    const style = o.style;
    const W = o.W, H = o.H, cx = W / 2, cy = H / 2, MAX = Math.hypot(W, H);
    const stars = Array.from({ length: 150 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(0.5, 2.6), p: rand(0, TAU) }));
    const slashes = Array.from({ length: 40 }, () => ({ x: rand(0, W), y: rand(0, H), a: rand(-1, 1), l: rand(80, 280), d: rand(0, 2.0) }));
    const eyes = Array.from({ length: 14 }, () => ({ x: rand(W * 0.08, W * 0.92), y: rand(H * 0.1, H * 0.9), p: rand(0, TAU) }));
    const ACC = style === "shrine" ? "#ff2230" : style === "shadow" ? "#7c8bff" : "#6ec3ff";
    return {
      dur: 3.0, under: true, domain: true,
      update(dt, ps) {
        if (!this.k) { this.k = true; mgr.punchScreen(34, "#fff"); }
        mgr.shake = Math.max(mgr.shake, 7 * Math.max(0, 1 - this.t / this.dur));
        // sure-hit pulse at ~0.7s
        if (!this.hit && this.t > 0.7) { this.hit = true; mgr.punchScreen(20, ACC); ps.ring(cx, cy, "#fff", 1.6, 70, 12); }
        if (style === "shrine" && Math.random() < 0.6) ps.stream(rand(0, W), rand(0, H), rand(-26, 26), rand(-26, 26), "#fff", 1.2, 3, 0.1);
        if (style === "void" && Math.random() < 0.5) ps.spawn({ x: rand(0, W), y: rand(0, H), vx: 0, vy: 0, life: 0.6, size: rand(1, 2.5), color: "#cfe0ff", glow: 1.2 });
      },
      render(ctx, ps, W, H) {
        const inT = Math.min(1, this.t / 0.45);
        const outT = this.t > this.dur - 0.6 ? (this.dur - this.t) / 0.6 : 1;
        const a = Math.min(inT, outT);
        const rot = this.t * 0.4;
        ctx.save();
        // base fill
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, MAX * 0.62);
        if (style === "void") { bg.addColorStop(0, "#241552"); bg.addColorStop(0.55, "#0a0524"); bg.addColorStop(1, "#000"); }
        else if (style === "shrine") { bg.addColorStop(0, "#360608"); bg.addColorStop(0.6, "#140103"); bg.addColorStop(1, "#000"); }
        else { bg.addColorStop(0, "#0d1030"); bg.addColorStop(0.6, "#04060f"); bg.addColorStop(1, "#000"); }
        ctx.globalAlpha = a * 0.94; ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

        ctx.globalCompositeOperation = "lighter";
        // radial light rays
        ctx.globalAlpha = a * 0.16; ctx.fillStyle = ACC;
        for (let i = 0; i < 28; i++) { const ang = i / 28 * TAU + rot; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang - 0.04) * MAX, cy + Math.sin(ang - 0.04) * MAX); ctx.lineTo(cx + Math.cos(ang + 0.04) * MAX, cy + Math.sin(ang + 0.04) * MAX); ctx.closePath(); ctx.fill(); }

        if (style === "void") {
          for (const s of stars) { const tw = 0.5 + 0.5 * Math.sin(this.t * 4 + s.p); ctx.globalAlpha = a * tw; ctx.fillStyle = "#cfe0ff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.s * 1.6, 0, TAU); ctx.fill(); }
          ctx.globalAlpha = a * 0.5; ctx.strokeStyle = "#6ec3ff"; ctx.lineWidth = 1;
          for (let i = 0; i < stars.length; i += 3) { const s1 = stars[i], s2 = stars[(i + 7) % stars.length]; if (Math.hypot(s1.x - s2.x, s1.y - s2.y) < 170) { ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke(); } }
          // concentric sigil
          ctx.globalAlpha = a * 0.6; ctx.strokeStyle = "#bfe3ff"; ctx.lineWidth = 2;
          for (let r = 1; r <= 4; r++) { ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.09 * r, 0, TAU); ctx.stroke(); }
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.beginPath();
          for (let i = 0; i < 6; i++) { const ang = i / 6 * TAU, rr = Math.min(W, H) * 0.34; i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
          ctx.closePath(); ctx.stroke(); ctx.restore();
        } else if (style === "shrine") {
          // torii silhouette
          ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = a * 0.85;
          ctx.fillStyle = "#0a0203"; ctx.strokeStyle = "#ff2230"; ctx.lineWidth = 3;
          const tw = W * 0.5, th = H * 0.5, tx = cx, ty = cy + H * 0.12;
          ctx.fillRect(tx - tw / 2 - 14, ty - th, 22, th); ctx.fillRect(tx + tw / 2 - 8, ty - th, 22, th);
          ctx.fillRect(tx - tw / 2 - 40, ty - th - 6, tw + 80, 26);
          ctx.fillRect(tx - tw / 2 - 28, ty - th + 28, tw + 56, 16);
          ctx.strokeRect(tx - tw / 2 - 40, ty - th - 6, tw + 80, 26);
          ctx.globalCompositeOperation = "lighter";
          for (const s of slashes) { if (this.t < s.d) continue; const sa = Math.max(0, 1 - (this.t - s.d) / 0.6) * a; ctx.globalAlpha = sa; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(s.a) * s.l, s.y + Math.sin(s.a) * s.l); ctx.stroke(); }
        } else { // shadow garden — ink flood + ripples + eyes
          for (let r = 0; r < 5; r++) { ctx.globalAlpha = a * 0.18; ctx.strokeStyle = "#7c8bff"; ctx.lineWidth = 2; const rr = ((this.t * 120 + r * 90) % (MAX * 0.6)); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); }
          ctx.globalAlpha = a; ctx.fillStyle = "#cdd4ff";
          for (const e of eyes) { const blink = Math.sin(this.t * 2 + e.p) > -0.8 ? 1 : 0.15; ctx.globalAlpha = a * blink; ctx.beginPath(); ctx.ellipse(e.x, e.y, 7, 4, 0, 0, TAU); ctx.ellipse(e.x + 18, e.y, 7, 4, 0, 0, TAU); ctx.fill(); }
        }
        // expanding barrier dome ring at cast
        if (this.t < 0.7) { const rr = ease(this.t / 0.7) * MAX * 0.6; ctx.globalAlpha = (1 - this.t / 0.7) * a; ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); }
        ctx.restore();
      },
    };
  },
};
