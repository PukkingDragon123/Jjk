// Roster for Jujutsu Web — a hand-sign sequence game (perform signs in order).
// Signs: open ✋ · fist ✊ · one ☝️ · two ✌️ · double 👐 · pray 🙏
// Each technique = an ordered sequence you must perform accurately, like jutsu signs.

export const CHARACTERS = [
  {
    id: "gojo", name: "Gojo Satoru", initial: "G", title: "Limitless · The Honored One",
    accent: "#39a8ff", art: "assets/gojo.jpg",
    palette: { a: "#39a0ff", b: "#b14bff", glow: "#bfe3ff" },
    techniques: [
      { id: "blue", name: "Cursed Technique: Blue", short: "BLUE", seq: ["open", "fist"], kind: "orb", sub: "attract", dmg: 16, sfx: "blue" },
      { id: "red", name: "Reversal: Red", short: "RED", seq: ["fist", "open"], kind: "burst", sub: "repel", dmg: 18, sfx: "red" },
      { id: "flame", name: "Cursed Flame", short: "BLUE FLAME", seq: ["two", "fist"], kind: "flame", dmg: 17, sfx: "fire" },
      { id: "purple", name: "Hollow Purple", short: "PURPLE", seq: ["open", "fist", "double"], kind: "beam", dmg: 46, sfx: "purple", ult: true },
      { id: "void", name: "Unlimited Void", short: "VOID", seq: ["fist", "open", "pray"], kind: "domain", style: "void", dmg: 64, sfx: "domain", domain: true },
    ],
  },
  {
    id: "sukuna", name: "Ryomen Sukuna", initial: "S", title: "King of Curses",
    accent: "#ff3b4e", art: "assets/sukuna.jpg",
    palette: { a: "#ff3b4e", b: "#ff8a3b", glow: "#ffd0c0" },
    techniques: [
      { id: "dismantle", name: "Dismantle", short: "DISMANTLE", seq: ["one", "two"], kind: "slash", dmg: 16, sfx: "slash" },
      { id: "cleave", name: "Cleave", short: "CLEAVE", seq: ["two", "one"], kind: "slashBig", dmg: 22, sfx: "slashBig" },
      { id: "spiderweb", name: "Spiderweb", short: "SPIDERWEB", seq: ["one", "one", "two"], kind: "slashBig", dmg: 26, sfx: "slashBig" },
      { id: "fire", name: "Fire Arrow", short: "FIRE ARROW", seq: ["one", "two", "double"], kind: "beam", warm: true, dmg: 44, sfx: "fire", ult: true },
      { id: "shrine", name: "Malevolent Shrine", short: "SHRINE", seq: ["two", "one", "pray"], kind: "domain", style: "shrine", dmg: 66, sfx: "domain", domain: true },
    ],
  },
  {
    id: "yuji", name: "Yuji Itadori", initial: "Y", title: "Sukuna's Vessel",
    accent: "#ff6a6a", art: "assets/yuji.jpg",
    palette: { a: "#ff6a6a", b: "#3a1414", glow: "#ffd0d0" },
    techniques: [
      { id: "jab", name: "Cursed Jab", short: "JAB", seq: ["fist", "open"], kind: "burst", dmg: 15, sfx: "punch" },
      { id: "divergent", name: "Divergent Fist", short: "DIVERGENT", seq: ["fist", "two"], kind: "burst", sub: "double", dmg: 18, sfx: "punch" },
      { id: "manji", name: "Manji Kick", short: "MANJI KICK", seq: ["two", "fist", "open"], kind: "burst", sub: "double", dmg: 24, sfx: "hammer" },
      { id: "blackflash", name: "Black Flash", short: "BLACK FLASH", seq: ["fist", "fist", "open"], kind: "flash", dmg: 40, sfx: "flash", ult: true },
      { id: "barrage", name: "Black Flash Barrage", short: "BARRAGE", seq: ["fist", "fist", "open", "pray"], kind: "flash", barrage: true, dmg: 60, sfx: "flash", domain: true },
    ],
  },
  {
    id: "megumi", name: "Megumi Fushiguro", initial: "M", title: "Ten Shadows Technique",
    accent: "#7c8bff", art: "assets/megumi.jpg",
    palette: { a: "#7c8bff", b: "#222a5c", glow: "#cfd6ff" },
    techniques: [
      { id: "dogs", name: "Divine Dogs", short: "DIVINE DOGS", seq: ["one", "fist"], kind: "beast", dmg: 16, sfx: "beast" },
      { id: "nue", name: "Nue", short: "NUE", seq: ["two", "open"], kind: "burst", sub: "bolt", dmg: 18, sfx: "bolt" },
      { id: "serpent", name: "Great Serpent", short: "SERPENT", seq: ["one", "one", "fist"], kind: "beast", big: true, dmg: 26, sfx: "beast" },
      { id: "elephant", name: "Max Elephant", short: "MAX ELEPHANT", seq: ["one", "two", "double"], kind: "beam", water: true, dmg: 44, sfx: "water", ult: true },
      { id: "garden", name: "Chimera Shadow Garden", short: "SHADOW GARDEN", seq: ["two", "one", "pray"], kind: "domain", style: "shadow", dmg: 62, sfx: "domain", domain: true },
    ],
  },
];

export function getCharacter(id) { return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0]; }
export function techById(char, id) { return char.techniques.find((t) => t.id === id) || null; }
