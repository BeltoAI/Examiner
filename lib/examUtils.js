export function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isTrueFalseChoiceList(choices) {
  if (!Array.isArray(choices)) return false;
  const norm = choices.map(c => String(c).trim().toLowerCase());
  const set = new Set(norm);
  return set.has("true") && set.has("false") && set.size <= 2;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
