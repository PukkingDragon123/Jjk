// Ranked progression using Jujutsu sorcerer grades. Stored locally (no server).
const KEY = "jjkw_profile_v1";

export const TIERS = [
  { name: "Grade 4", tag: "4",  min: 0,   color: "#9aa0b5" },
  { name: "Grade 3", tag: "3",  min: 120, color: "#7fd1a8" },
  { name: "Grade 2", tag: "2",  min: 280, color: "#5cc0ff" },
  { name: "Semi-Grade 1", tag: "1−", min: 480, color: "#b48bff" },
  { name: "Grade 1", tag: "1",  min: 700, color: "#ffb13b" },
  { name: "Special Grade", tag: "SP", min: 980, color: "#ff3b4e" },
];

export function load() {
  try { return Object.assign({ points: 0, wins: 0, losses: 0, streak: 0 }, JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch (e) { return { points: 0, wins: 0, losses: 0, streak: 0 }; }
}
export function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }

export function tierFor(points) {
  let t = TIERS[0];
  for (const x of TIERS) if (points >= x.min) t = x;
  return t;
}

export function nextTier(points) {
  return TIERS.find((x) => x.min > points) || null;
}

// returns { profile, delta, tier, promoted, demoted }
export function recordResult(win) {
  const p = load();
  const before = tierFor(p.points);
  let delta;
  if (win) { p.streak = Math.max(1, p.streak + 1); p.wins++; delta = 25 + Math.min(15, (p.streak - 1) * 5); }
  else { p.streak = Math.min(-1, p.streak - 1); p.losses++; delta = -(16 + Math.min(8, (Math.abs(p.streak) - 1) * 3)); }
  p.points = Math.max(0, p.points + delta);
  save(p);
  const after = tierFor(p.points);
  return { profile: p, delta, tier: after, promoted: after.min > before.min, demoted: after.min < before.min };
}
