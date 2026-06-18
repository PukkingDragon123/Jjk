// Loadout & upgrade persistence (localStorage): equipped skills, levels, coins.
import { CHARACTERS, skillById } from "./characters.js";

const KEY = "jjkw_loadout_v1";
export const MAX_LEVEL = 3;
export const UP_COST = [0, 40, 90]; // cost to reach level 2, level 3

function fresh() {
  const equipped = {}, levels = {};
  for (const c of CHARACTERS) {
    equipped[c.id] = c.skills.slice(0, 3).map((s) => s.id);
    levels[c.id] = {};
  }
  return { coins: 60, equipped, levels };
}

let data = null;
function read() {
  if (data) return data;
  try { data = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch (e) { data = fresh(); }
  // repair missing entries
  for (const c of CHARACTERS) {
    if (!data.equipped[c.id] || data.equipped[c.id].length !== 3) data.equipped[c.id] = c.skills.slice(0, 3).map((s) => s.id);
    if (!data.levels[c.id]) data.levels[c.id] = {};
  }
  return data;
}
function write() { try { localStorage.setItem(KEY, JSON.stringify(read())); } catch (e) {} }

export const coins = () => read().coins;
export function addCoins(n) { read().coins += n; write(); }

export const getEquipped = (charId) => read().equipped[charId].slice();
export function equip(charId, slot, skillId) {
  const eq = read().equipped[charId];
  const existing = eq.indexOf(skillId);
  if (existing >= 0 && existing !== slot) eq[existing] = eq[slot]; // swap to avoid duplicates
  eq[slot] = skillId; write();
}
export const level = (charId, skillId) => read().levels[charId][skillId] || 1;
export function upgradeCost(charId, skillId) {
  const lv = level(charId, skillId);
  return lv >= MAX_LEVEL ? null : UP_COST[lv];
}
export function upgrade(charId, skillId) {
  const cost = upgradeCost(charId, skillId);
  if (cost == null || read().coins < cost) return false;
  read().coins -= cost;
  read().levels[charId][skillId] = level(charId, skillId) + 1;
  write(); return true;
}

// effective stats for a move at a given level (+25% dmg per level)
export function effective(move, lv) {
  const mult = 1 + 0.25 * (lv - 1);
  return Object.assign({}, move, { dmg: Math.round((move.dmg || 0) * mult), lvl: lv });
}

// the 5 active moves for a character: 3 equipped (signs fist/one/two) + ult + domain
import { SLOT_SIGNS } from "./characters.js";
export function activeBook(char) {
  const eq = getEquipped(char.id);
  const book = eq.map((id, i) => {
    const base = skillById(char, id) || char.skills[i];
    const m = effective(base, level(char.id, base.id));
    m.sign = SLOT_SIGNS[i]; m.tier = m.kind === "guard" ? "utility" : "basic"; m.slot = i;
    m.cost = base.cost ?? 0.1;       // cursed-energy (mana) cost
    return m;
  });
  const u = effective(char.ultimate, level(char.id, char.ultimate.id)); u.sign = "double"; u.tier = "ultimate"; u.cost = char.ultimate.cost ?? 0.45;
  const d = effective(char.domain, level(char.id, char.domain.id)); d.sign = "pray"; d.tier = "domain"; d.cost = 0; d.surge = 1; // Domain consumes the Surge meter
  book.push(u, d);
  return book;
}
