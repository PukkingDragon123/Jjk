// Single-player story campaign: exorcise cursed spirits across a few stages.
// All flavour text below is original.

export const STAGES = [
  {
    name: "Lurking Curse", jp: "蠢く呪霊", emoji: "👁️", color: "#7fd1a8",
    hp: 60, atkEvery: 3.4, atkDmg: 8, atkName: "Grasp",
    story: "A weak curse has nested in a shuttered arcade, feeding on leftover fear. Your first assignment: exorcise it.",
    clear: "The curse dissolves into smoke. Routine — but everyone starts somewhere.",
  },
  {
    name: "Finger Bearer", jp: "指持ち", emoji: "🩸", color: "#ff8a3b",
    hp: 95, atkEvery: 3.0, atkDmg: 11, atkName: "Lunge",
    story: "It swallowed a cursed finger and swelled with power. It's faster now, and hungry. Don't let it corner you.",
    clear: "Down it goes. Your cursed energy flows a little smoother than before.",
  },
  {
    name: "Cursed Womb", jp: "呪胎", emoji: "🥚", color: "#b14bff",
    hp: 130, atkEvery: 2.7, atkDmg: 14, atkName: "Wail",
    story: "A born-from-humans curse, half-formed and screaming. It hits hard between breaths — time your domain.",
    clear: "Silence at last. You're holding your own against real threats.",
  },
  {
    name: "Special Grade", jp: "特級呪霊", emoji: "👹", color: "#ff3b4e",
    hp: 180, atkEvery: 2.3, atkDmg: 17, atkName: "Cataclysm",
    story: "Disaster-class. The air itself feels heavier. Read its rhythm, chain your combos, and end it before it ends you.",
    clear: "Impossible odds, exorcised. You're not the strongest yet — but the gap is closing.",
  },
];

export class Enemy {
  constructor(stage) {
    this.s = stage;
    this.hp = stage.hp; this.max = stage.hp;
    this.t = 0; this.next = stage.atkEvery + 1.2; // grace before first attack
    this.telegraph = 0; // >0 while winding up
    this.dead = false;
  }
  // returns { attack: {dmg,name} } on the frame it strikes
  update(dt) {
    if (this.dead) return null;
    this.t += dt;
    if (this.telegraph > 0) {
      this.telegraph -= dt;
      if (this.telegraph <= 0) return { attack: { dmg: this.s.atkDmg, name: this.s.atkName } };
      return null;
    }
    if (this.t >= this.next) { this.next = this.t + this.s.atkEvery; this.telegraph = 0.75; return { telegraph: this.s.atkName }; }
    return null;
  }
  damage(d) { this.hp = Math.max(0, this.hp - d); if (this.hp <= 0) this.dead = true; return this.dead; }
  get pct() { return this.hp / this.max; }
}

const KEY = "jjkw_campaign_v1";
export function loadProgress() { try { return Math.max(0, parseInt(localStorage.getItem(KEY) || "0", 10)) || 0; } catch (e) { return 0; } }
export function saveProgress(i) { try { localStorage.setItem(KEY, String(i)); } catch (e) {} }
