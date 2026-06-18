// Roster for Jujutsu Web — 100% Jujutsu Kaisen themed, English labels only.
// Each character has a SKILL POOL; you equip 3 into your loadout slots
// (signs ✊ ☝️ ✌️), plus a fixed Ultimate (👐) and Domain (🙏). Skills upgrade.

export const SLOT_SIGNS = ["fist", "one", "two"]; // loadout slot -> hand sign

export const CHARACTERS = [
  {
    id: "gojo", name: "Gojo Satoru", initial: "G", title: "Limitless · The Honored One",
    grade: "Special Grade", accent: "#3aa0ff", art: "assets/gojo.jpg",
    palette: { a: "#39a0ff", b: "#b14bff", glow: "#bfe3ff" },
    look: { style: "gojo", hair: "#eef1ff", hair2: "#c6ccf0", band: "#171922", aura: "rings" },
    skills: [
      { id: "blue",    name: "Cursed Technique Lapse: Blue", short: "BLUE",   kind: "orb",   sub: "attract", dmg: 14, sfx: "blue", cost: 0.10, desc: "Attracts everything toward a point." },
      { id: "red",     name: "Cursed Technique Reversal: Red", short: "RED",  kind: "burst", sub: "repel",   dmg: 18, sfx: "red",  cost: 0.13, desc: "A violent repulsion blast." },
      { id: "cflame",  name: "Cursed Flame",         short: "BLUE FLAME", kind: "flame", dmg: 17, sfx: "fire", cost: 0.12, desc: "A lance of blue cursed flame." },
      { id: "barrage", name: "Blue Barrage",         short: "BLUE×", kind: "nails", dmg: 16, sfx: "blue", cost: 0.13, desc: "A volley of converging blue spheres." },
      { id: "maxblue", name: "Lapse: Maximum Blue",  short: "MAX BLUE", kind: "orb", sub: "attract", dmg: 23, sfx: "blue", cost: 0.16, desc: "An overcharged, heavier Blue." },
      { id: "infinity", name: "Infinity",            short: "INFINITY", kind: "guard", dmg: 0, sfx: "ui", cost: 0.08, desc: "Neutral Limitless — a brief moment of invulnerability." },
    ],
    ultimate: { id: "purple", name: "Hollow Technique: Purple", short: "PURPLE", sign: "double", kind: "beam", dmg: 46, sfx: "purple", tier: "ultimate", cost: 0.5, desc: "Blue and Red collide into an imaginary mass." },
    domain:   { id: "void",   name: "Unlimited Void",           short: "VOID",   sign: "pray",   kind: "domain", style: "void", dmg: 62, sfx: "domain", tier: "domain", cost: 1, desc: "Floods the target with infinite information." },
    comboFinisher: { id: "purplec", name: "Imaginary Purple", short: "PURPLE!", kind: "beam", dmg: 40, sfx: "purple" },
  },
  {
    id: "sukuna", name: "Ryomen Sukuna", initial: "S", title: "King of Curses",
    grade: "Special Grade", accent: "#ff3b4e", art: "assets/sukuna.jpg",
    palette: { a: "#ff3b4e", b: "#ff8a3b", glow: "#ffd0c0" },
    look: { style: "sukuna", hair: "#2a2230", hair2: "#ff4d5e", marks: "#c01230", aura: "claw" },
    skills: [
      { id: "dismantle", name: "Dismantle",     short: "DISMANTLE", kind: "slash",    dmg: 14, sfx: "slash", desc: "An automatic slash at anything in range." },
      { id: "cleave",    name: "Cleave",        short: "CLEAVE",    kind: "slashBig", dmg: 22, sfx: "slashBig", desc: "A single adjusted slash, scaled to the target." },
      { id: "spiderweb", name: "Spiderweb",     short: "SPIDERWEB", kind: "slashBig", dmg: 19, sfx: "slashBig", desc: "A lattice of crossing slashes." },
      { id: "flame",     name: "Flame Slash",   short: "FLAME",     kind: "flame", warm: true, sfx: "fire", dmg: 17, desc: "A burning crimson cut." },
      { id: "strike",    name: "Cursed Strike", short: "STRIKE",    kind: "burst", dmg: 16, sfx: "punch", desc: "A brutal close blow." },
      { id: "volley",    name: "Dismantle Volley", short: "VOLLEY", kind: "nails", dmg: 16, sfx: "slash", desc: "A scatter of small slashes." },
    ],
    ultimate: { id: "fire", name: "Fire Arrow",          short: "FIRE ARROW", sign: "double", kind: "beam", warm: true, dmg: 42, sfx: "fire", tier: "ultimate", cost: 0.5, desc: "Compressed flame fired as an arrow." },
    domain:   { id: "shrine", name: "Malevolent Shrine", short: "SHRINE",     sign: "pray",   kind: "domain", style: "shrine", dmg: 64, sfx: "domain", tier: "domain", cost: 1, desc: "A sure-hit shrine of endless dismantling." },
    comboFinisher: { id: "cleavec", name: "Cleave & Dismantle", short: "CLEAVE!", kind: "slashBig", big: true, dmg: 34, sfx: "slashBig" },
  },
  {
    id: "yuji", name: "Yuji Itadori", initial: "Y", title: "Sukuna's Vessel",
    grade: "Grade 1", accent: "#ff6a6a", art: "assets/yuji.jpg",
    palette: { a: "#ff6a6a", b: "#3a1414", glow: "#ffd0d0" },
    look: { style: "cap", hair: "#ff9bb0", cap: "#d63347", aura: "spark" },
    skills: [
      { id: "jab",       name: "Jab",            short: "JAB",       kind: "burst", dmg: 12, sfx: "punch", desc: "A fast reinforced punch." },
      { id: "divergent", name: "Divergent Fist", short: "DIVERGENT", kind: "burst", sub: "double", dmg: 17, sfx: "punch", desc: "A delayed second impact lands after the first." },
      { id: "manji",     name: "Manji Kick",     short: "MANJI",     kind: "burst", dmg: 18, sfx: "punch", desc: "A heavy spinning kick." },
      { id: "smash",     name: "Cursed Smash",   short: "SMASH",     kind: "burst", sub: "double", dmg: 16, sfx: "hammer", desc: "An overhead cursed-energy smash." },
      { id: "combo",     name: "Strike Combo",   short: "COMBO",     kind: "burst", dmg: 15, sfx: "punch", desc: "A rapid flurry of blows." },
      { id: "counter",   name: "Counter Throw",  short: "COUNTER",   kind: "burst", dmg: 14, sfx: "punch", desc: "Redirect momentum into a throw." },
    ],
    ultimate: { id: "blackflash", name: "Black Flash", short: "BLACK FLASH", sign: "double", kind: "flash", dmg: 36, sfx: "flash", tier: "ultimate", cost: 0.5, desc: "A pinpoint hit that warps space — cursed energy in a flash." },
    domain:   { id: "barrage",    name: "Black Flash Barrage", short: "BARRAGE", sign: "pray", kind: "flash", barrage: true, dmg: 58, sfx: "flash", tier: "domain", cost: 1, desc: "A relentless chain of Black Flashes." },
    comboFinisher: { id: "bfc", name: "Black Flash!", short: "BLACK FLASH!", kind: "flash", dmg: 42, sfx: "flash" },
  },
  {
    id: "megumi", name: "Megumi Fushiguro", initial: "M", title: "Ten Shadows Technique",
    grade: "Grade 2", accent: "#7c8bff", art: "assets/megumi.jpg",
    palette: { a: "#7c8bff", b: "#222a5c", glow: "#cfd6ff" },
    look: { style: "spiky", hair: "#1b2138", hair2: "#3c4680", aura: "ink" },
    skills: [
      { id: "dogs",    name: "Divine Dogs",   short: "DIVINE DOGS", kind: "beast", dmg: 15, sfx: "beast", desc: "Twin shadow hounds rush the target." },
      { id: "nue",     name: "Nue",           short: "NUE",         kind: "burst", sub: "bolt", dmg: 16, sfx: "bolt", desc: "A shadow bird strikes with lightning." },
      { id: "toad",    name: "Toad",          short: "TOAD",        kind: "beast", dmg: 14, sfx: "beast", desc: "A shikigami toad lunges and grabs." },
      { id: "serpent", name: "Great Serpent", short: "SERPENT",     kind: "beast", big: true, dmg: 19, sfx: "beast", desc: "A massive shadow serpent." },
      { id: "rabbits", name: "Rabbit Escape", short: "RABBITS",     kind: "nails", dmg: 13, sfx: "beast", desc: "A swarm of shadow rabbits scatter the foe." },
      { id: "nuedive", name: "Nue Dive",      short: "NUE DIVE",    kind: "burst", sub: "bolt", dmg: 17, sfx: "bolt", desc: "A diving electric strike." },
    ],
    ultimate: { id: "elephant", name: "Max Elephant", short: "MAX ELEPHANT", sign: "double", kind: "beam", water: true, dmg: 38, sfx: "water", tier: "ultimate", cost: 0.5, desc: "A colossal shikigami unleashes a flood." },
    domain:   { id: "garden",   name: "Chimera Shadow Garden", short: "SHADOW GARDEN", sign: "pray", kind: "domain", style: "shadow", dmg: 58, sfx: "domain", tier: "domain", cost: 1, desc: "An ocean of shadow at your command." },
    comboFinisher: { id: "totality", name: "Divine Dog: Totality", short: "TOTALITY", kind: "beast", big: true, dmg: 32, sfx: "beast" },
  },
];

export function getCharacter(id) { return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0]; }
export function skillById(char, id) {
  return char.skills.find((s) => s.id === id) || (char.ultimate.id === id ? char.ultimate : char.domain.id === id ? char.domain : null);
}
