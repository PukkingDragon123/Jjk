// Story campaign: mobile, telegraphing cursed spirits. Harder & more intense —
// the curse roams the arena and you must dodge (swipe) or counter (sign).
// All flavour text below is original.

const rand = (a, b) => a + Math.random() * (b - a);

export const STAGES = [
  {
    name: "Lurking Curse", emoji: "👁️", color: "#7fd1a8",
    hp: 70, atkEvery: 2.7, atkDmg: 9, atkName: "Grasp",
    story: "A weak curse has nested in a shuttered arcade, feeding on leftover fear. Your first assignment: exorcise it.",
    clear: "The curse dissolves into smoke. Routine — but everyone starts somewhere.",
  },
  {
    name: "Finger Bearer", emoji: "🩸", color: "#ff8a3b",
    hp: 115, atkEvery: 2.4, atkDmg: 12, atkName: "Lunge",
    story: "It swallowed a cursed finger and swelled with power. It darts around now — keep moving, read the tells, dodge.",
    clear: "Down it goes. Your cursed energy flows a little smoother than before.",
  },
  {
    name: "Cursed Womb", emoji: "🥚", color: "#b14bff",
    hp: 155, atkEvery: 2.1, atkDmg: 15, atkName: "Wail",
    story: "A born-from-humans curse, half-formed and screaming. It hits hard and fast — time your counters.",
    clear: "Silence at last. You're holding your own against real threats.",
  },
  {
    name: "Special Grade", emoji: "👹", color: "#ff3b4e",
    hp: 210, atkEvery: 1.85, atkDmg: 18, atkName: "Cataclysm",
    story: "Disaster-class. The air itself feels heavier. It will rush you when wounded — counter, dodge, and end it.",
    clear: "Impossible odds, exorcised. You're not the strongest yet — but the gap is closing.",
  },
];

export class Enemy {
  constructor(stage) {
    this.s = stage; this.hp = stage.hp; this.max = stage.hp;
    this.t = 0; this.next = stage.atkEvery + 1.0; this.telegraph = 0; this.dead = false;
    this.pos = { x: 0.5, y: 0.28 }; this.target = { x: 0.5, y: 0.28 }; this.moveT = 1.4;
    this.pending = null; this.info = null;
  }
  get pct() { return this.hp / this.max; }
  get enraged() { return this.pct < 0.4; }

  // returns null | {telegraph:{type,dir,name,dur}} | {attack:{type,dir,dmg,name}}
  update(dt) {
    if (this.dead) return null;
    this.t += dt; this.moveT -= dt;
    if (this.telegraph <= 0 && this.moveT <= 0) {
      this.target = { x: rand(0.16, 0.84), y: rand(0.15, 0.42) };
      this.moveT = rand(this.enraged ? 0.7 : 1.0, this.enraged ? 1.6 : 2.2);
    }
    const k = Math.min(1, dt * (this.enraged ? 3.2 : 2.4));
    this.pos.x += (this.target.x - this.pos.x) * k;
    this.pos.y += (this.target.y - this.pos.y) * k;

    if (this.telegraph > 0) {
      this.telegraph -= dt;
      if (this.telegraph <= 0) { const p = this.pending; this.pending = null; this.info = null; return { attack: p }; }
      return null;
    }
    if (this.t >= this.next) {
      const e = this.enraged ? 0.66 : 1;
      this.next = this.t + this.s.atkEvery * e;
      const type = Math.random() < 0.5 ? "dodge" : "counter";
      const dir = Math.random() < 0.5 ? "left" : "right";
      this.pending = { type, dir, dmg: this.s.atkDmg, name: this.s.atkName };
      this.info = { type, dir };
      this.telegraph = this.enraged ? 0.58 : 0.8;
      return { telegraph: { type, dir, name: this.s.atkName, dur: this.telegraph } };
    }
    return null;
  }
  damage(d) { this.hp = Math.max(0, this.hp - d); if (this.hp <= 0) this.dead = true; return this.dead; }
}

const KEY = "jjkw_campaign_v1";
export function loadProgress() { try { return Math.max(0, parseInt(localStorage.getItem(KEY) || "0", 10)) || 0; } catch (e) { return 0; } }
export function saveProgress(i) { try { localStorage.setItem(KEY, String(i)); } catch (e) {} }
