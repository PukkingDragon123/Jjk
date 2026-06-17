// Tiny synthesized SFX engine (Web Audio). No external audio assets.
let ctx = null;
let master = null;
export let muted = false;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlockAudio() { try { ac(); } catch (e) {} }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }

function env(node, t, a, d, peak = 1) {
  const g = node.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(peak, t + a);
  g.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone({ type = "sine", f0, f1, dur = 0.4, gain = 0.5, a = 0.01 }) {
  if (muted) return;
  const c = ac(), t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, a, dur, gain);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise({ dur = 0.3, gain = 0.4, a = 0.005, hp = 300, lp = 8000 }) {
  if (muted) return;
  const c = ac(), t = c.currentTime;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain(); env(g, t, a, dur, gain);
  const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = hp;
  const lpf = c.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = lp;
  src.connect(hpf).connect(lpf).connect(g).connect(master);
  src.start(t);
}

const SFX = {
  charge:  () => tone({ type: "sawtooth", f0: 80,  f1: 520, dur: 0.6, gain: 0.18 }),
  blue:    () => { tone({ type: "sine", f0: 900, f1: 140, dur: 0.5, gain: 0.35 }); noise({ dur: 0.4, gain: 0.12, hp: 600 }); },
  red:     () => { tone({ type: "square", f0: 120, f1: 700, dur: 0.4, gain: 0.3 }); noise({ dur: 0.25, gain: 0.25, hp: 200 }); },
  purple:  () => { tone({ type: "sawtooth", f0: 200, f1: 60, dur: 1.0, gain: 0.4 }); tone({ type: "sine", f0: 1200, f1: 200, dur: 0.9, gain: 0.25 }); noise({ dur: 0.9, gain: 0.2, hp: 120 }); },
  slash:   () => { noise({ dur: 0.18, gain: 0.5, hp: 1800, lp: 12000 }); tone({ type: "triangle", f0: 1600, f1: 400, dur: 0.15, gain: 0.2 }); },
  slashBig:() => { noise({ dur: 0.3, gain: 0.55, hp: 800 }); tone({ type: "sawtooth", f0: 300, f1: 70, dur: 0.3, gain: 0.3 }); },
  fire:    () => { noise({ dur: 0.8, gain: 0.4, hp: 200, lp: 5000 }); tone({ type: "sawtooth", f0: 400, f1: 90, dur: 0.8, gain: 0.3 }); },
  beast:   () => { tone({ type: "sawtooth", f0: 220, f1: 80, dur: 0.5, gain: 0.3 }); noise({ dur: 0.3, gain: 0.2, hp: 300, lp: 3000 }); },
  water:   () => { noise({ dur: 0.7, gain: 0.35, hp: 150, lp: 2500 }); },
  bolt:    () => { noise({ dur: 0.2, gain: 0.4, hp: 2500 }); tone({ type: "square", f0: 2000, f1: 400, dur: 0.15, gain: 0.2 }); },
  punch:   () => { tone({ type: "sine", f0: 160, f1: 50, dur: 0.25, gain: 0.5 }); noise({ dur: 0.12, gain: 0.3, hp: 400 }); },
  hammer:  () => { tone({ type: "sine", f0: 110, f1: 40, dur: 0.35, gain: 0.55 }); },
  nails:   () => { for (let i = 0; i < 5; i++) setTimeout(() => noise({ dur: 0.08, gain: 0.25, hp: 3000 }), i * 45); },
  flash:   () => { tone({ type: "sine", f0: 1400, f1: 60, dur: 0.5, gain: 0.6 }); noise({ dur: 0.3, gain: 0.4, hp: 100 }); },
  domain:  () => { tone({ type: "sine", f0: 60, f1: 30, dur: 1.6, gain: 0.5 }); tone({ type: "sawtooth", f0: 300, f1: 800, dur: 1.4, gain: 0.2 }); noise({ dur: 1.4, gain: 0.18, hp: 80, lp: 1200 }); },
  hit:     () => { tone({ type: "square", f0: 200, f1: 60, dur: 0.18, gain: 0.4 }); noise({ dur: 0.1, gain: 0.3 }); },
  shutter: () => { noise({ dur: 0.05, gain: 0.5, hp: 2000 }); tone({ type: "sine", f0: 1800, f1: 1800, dur: 0.03, gain: 0.2 }); },
  ui:      () => tone({ type: "sine", f0: 660, f1: 880, dur: 0.08, gain: 0.15 }),
};

export function play(name) {
  try { (SFX[name] || (() => {}))(); } catch (e) {}
}
