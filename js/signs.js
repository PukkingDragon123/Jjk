// The hand signs the camera recognises. Each spell is bound to one of these.
// Single-hand signs use a finger-extension pattern; two-hand signs use both.
export const SIGNS = {
  open:   { emoji: "✋", label: "Open palm",        hint: "Spread all five fingers" },
  fist:   { emoji: "✊", label: "Fist",             hint: "Close your hand" },
  one:    { emoji: "☝️", label: "Index up",         hint: "Point with your index finger" },
  two:    { emoji: "✌️", label: "Two fingers",      hint: "Index + middle (peace sign)" },
  double: { emoji: "👐", label: "Both palms out",   hint: "Open BOTH hands together — ultimate" },
  pray:   { emoji: "🙏", label: "Hands clasped",    hint: "Clasp BOTH hands — Domain (needs full energy)" },
};

export function signOf(id) { return SIGNS[id] || { emoji: "•", label: id, hint: "" }; }
