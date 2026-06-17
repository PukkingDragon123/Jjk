// Character roster. Each move is bound to a hand SIGN (see signs.js).
// Tiers: basic (free, ~0.5s cooldown) · ultimate (needs energy) · domain (needs FULL energy).
// combos: perform the basic signs in sequence (within a few seconds) for a finisher.
// `art` = optional fan-art at assets/<id>.png (falls back to a stencil kanji).

export const CHARACTERS = [
  {
    id: "gojo", name: "Gojo Satoru", glyph: "無", title: "Limitless · The Honored One",
    grade: "Special Grade", accent: "#7b5cff", art: "assets/gojo.png",
    palette: { a: "#39a0ff", b: "#b14bff", glow: "#9ad4ff" },
    moves: [
      { id: "blue",   name: "Blue",          jp: "蒼", sign: "open", kind: "orb",  sub: "attract", dmg: 14, sfx: "blue",   tier: "basic" },
      { id: "red",    name: "Reversal Red",  jp: "赫", sign: "fist", kind: "burst", sub: "repel",  dmg: 18, sfx: "red",    tier: "basic" },
      { id: "purple", name: "Hollow Purple", jp: "紫", sign: "double", kind: "beam", dmg: 46, sfx: "purple", tier: "ultimate", cost: 0.5 },
      { id: "void",   name: "Unlimited Void", jp: "無量空処", sign: "pray", kind: "domain", style: "void", dmg: 62, sfx: "domain", tier: "domain", cost: 1 },
    ],
    combos: [
      { seq: ["blue", "red"], result: { id: "purple", name: "Hollow Purple", jp: "紫", kind: "beam", dmg: 46, sfx: "purple" } },
    ],
  },
  {
    id: "sukuna", name: "Ryomen Sukuna", glyph: "両", title: "King of Curses",
    grade: "Special Grade", accent: "#ff3b4e", art: "assets/sukuna.png",
    palette: { a: "#ff3b4e", b: "#ff8a3b", glow: "#ff9aa2" },
    moves: [
      { id: "dismantle", name: "Dismantle", jp: "解", sign: "one", kind: "slash",    dmg: 14, sfx: "slash",    tier: "basic" },
      { id: "cleave",    name: "Cleave",    jp: "捌", sign: "two", kind: "slashBig", dmg: 22, sfx: "slashBig", tier: "basic" },
      { id: "fire",      name: "Fire Arrow", jp: "開", sign: "double", kind: "beam", warm: true, dmg: 42, sfx: "fire", tier: "ultimate", cost: 0.5 },
      { id: "shrine",    name: "Malevolent Shrine", jp: "伏魔御廚子", sign: "pray", kind: "domain", style: "shrine", dmg: 64, sfx: "domain", tier: "domain", cost: 1 },
    ],
    combos: [
      { seq: ["dismantle", "dismantle", "cleave"], result: { id: "spiderweb", name: "Spiderweb", jp: "蜘蛛の巣", kind: "slashBig", big: true, dmg: 34, sfx: "slashBig" } },
    ],
  },
  {
    id: "yuji", name: "Yuji Itadori", glyph: "黒", title: "Sukuna's Vessel",
    grade: "Grade 1", accent: "#ff5a5a", art: "assets/yuji.png",
    palette: { a: "#ff5a5a", b: "#2a1a1a", glow: "#ffd0d0" },
    moves: [
      { id: "jab",       name: "Jab",            jp: "拳", sign: "fist", kind: "burst", dmg: 12, sfx: "punch", tier: "basic" },
      { id: "divergent", name: "Divergent Fist", jp: "逕庭拳", sign: "two", kind: "burst", sub: "double", dmg: 16, sfx: "punch", tier: "basic" },
      { id: "blackflash", name: "Black Flash",   jp: "黒閃", sign: "double", kind: "flash", dmg: 34, sfx: "flash", tier: "ultimate", cost: 0.5 },
      { id: "barrage",   name: "Black Flash Barrage", jp: "連黒閃", sign: "pray", kind: "flash", barrage: true, dmg: 56, sfx: "flash", tier: "domain", cost: 1 },
    ],
    combos: [
      { seq: ["jab", "jab", "divergent"], result: { id: "blackflash", name: "BLACK FLASH", jp: "黒閃", kind: "flash", dmg: 40, sfx: "flash" } },
    ],
  },
  {
    id: "megumi", name: "Megumi Fushiguro", glyph: "影", title: "Ten Shadows Technique",
    grade: "Grade 2", accent: "#6b7bff", art: "assets/megumi.png",
    palette: { a: "#6b7bff", b: "#1b2350", glow: "#aeb8ff" },
    moves: [
      { id: "dogs", name: "Divine Dogs", jp: "玉犬", sign: "one", kind: "beast", dmg: 15, sfx: "beast", tier: "basic" },
      { id: "nue",  name: "Nue",         jp: "鵺",  sign: "two", kind: "burst", sub: "bolt", dmg: 16, sfx: "bolt", tier: "basic" },
      { id: "elephant", name: "Max Elephant", jp: "満象", sign: "double", kind: "beam", water: true, dmg: 38, sfx: "water", tier: "ultimate", cost: 0.5 },
      { id: "garden", name: "Chimera Shadow Garden", jp: "嵌合暗翳庭", sign: "pray", kind: "domain", style: "shadow", dmg: 58, sfx: "domain", tier: "domain", cost: 1 },
    ],
    combos: [
      { seq: ["dogs", "dogs"], result: { id: "totality", name: "Divine Dog: Totality", jp: "満象", kind: "beast", big: true, dmg: 30, sfx: "beast" } },
    ],
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
export function moveBySign(char, sign) {
  return char.moves.find((m) => m.sign === sign) || null;
}
