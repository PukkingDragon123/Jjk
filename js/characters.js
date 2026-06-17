// Character roster. Each move maps a gesture-slot -> a VFX primitive + palette + name.
// Slots: charge (hold open palm), blast (push/point), special (two hands together),
// melee (fist thrust), domain (clasp both hands when energy is full).
// `art` = drop your fan-art here (assets/<id>.png) and it shows on cards / HUD / photos.

export const CHARACTERS = [
  {
    id: "gojo",
    name: "Gojo Satoru",
    glyph: "無",
    title: "The Honored One · Limitless",
    grade: "Special Grade",
    accent: "#7b5cff",
    art: "assets/gojo.png",
    palette: { a: "#39a0ff", b: "#b14bff", glow: "#9ad4ff" },
    moves: {
      blast:   { name: "Cursed Technique Lapse · Blue", jp: "蒼", kind: "orb",   sub: "attract", dmg: 14, sfx: "blue" },
      special: { name: "Hollow Technique · Purple",      jp: "紫", kind: "beam",  dmg: 42, sfx: "purple" },
      melee:   { name: "Reversal Red",                    jp: "赫", kind: "burst", sub: "repel", dmg: 18, sfx: "red" },
      domain:  { name: "Unlimited Void",                  jp: "無量空処", kind: "domain", style: "void", dmg: 60, sfx: "domain" },
    },
  },
  {
    id: "sukuna",
    name: "Ryomen Sukuna",
    glyph: "両",
    title: "King of Curses",
    grade: "Special Grade",
    accent: "#ff3b4e",
    art: "assets/sukuna.png",
    palette: { a: "#ff3b4e", b: "#ff8a3b", glow: "#ff9aa2" },
    moves: {
      blast:   { name: "Dismantle",        jp: "解", kind: "slash", dmg: 15, sfx: "slash" },
      special: { name: "Fire Arrow · Kamino", jp: "開", kind: "beam", warm: true, dmg: 40, sfx: "fire" },
      melee:   { name: "Cleave",           jp: "捌", kind: "slashBig", dmg: 22, sfx: "slashBig" },
      domain:  { name: "Malevolent Shrine", jp: "伏魔御廚子", kind: "domain", style: "shrine", dmg: 62, sfx: "domain" },
    },
  },
  {
    id: "yuji",
    name: "Yuji Itadori",
    glyph: "黒",
    title: "Sukuna's Vessel",
    grade: "Grade 1",
    accent: "#ff5a5a",
    art: "assets/yuji.png",
    palette: { a: "#ff5a5a", b: "#2a1a1a", glow: "#ffd0d0" },
    moves: {
      blast:   { name: "Divergent Fist", jp: "逕庭拳", kind: "burst", sub: "double", dmg: 16, sfx: "punch" },
      special: { name: "Black Flash Barrage", jp: "連黒閃", kind: "flash", barrage: true, dmg: 44, sfx: "flash" },
      melee:   { name: "BLACK FLASH",    jp: "黒閃", kind: "flash", dmg: 30, sfx: "flash" },
      domain:  { name: "Manji Kick · True", jp: "卍蹴り", kind: "burst", sub: "double", big: true, dmg: 40, sfx: "punch" },
    },
  },
  {
    id: "megumi",
    name: "Megumi Fushiguro",
    glyph: "影",
    title: "Ten Shadows Technique",
    grade: "Grade 2",
    accent: "#6b7bff",
    art: "assets/megumi.png",
    palette: { a: "#6b7bff", b: "#1b2350", glow: "#aeb8ff" },
    moves: {
      blast:   { name: "Divine Dogs",   jp: "玉犬", kind: "beast", dmg: 15, sfx: "beast" },
      special: { name: "Max Elephant",  jp: "満象", kind: "beam", water: true, dmg: 36, sfx: "water" },
      melee:   { name: "Nue",           jp: "鵺",  kind: "burst", sub: "bolt", dmg: 16, sfx: "bolt" },
      domain:  { name: "Chimera Shadow Garden", jp: "嵌合暗翳庭", kind: "domain", style: "shadow", dmg: 55, sfx: "domain" },
    },
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
