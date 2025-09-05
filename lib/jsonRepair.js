// Conservative JSON repair: extract outermost JSON object/array, fix quotes & trailing commas.
export function tryParseJsonLoose(txt) {
  if (!txt) return null;
  let s = String(txt).trim();
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // Find first { or [
  const o1 = s.indexOf("{");
  const a1 = s.indexOf("[");
  let start = -1, open = "";
  if (o1 !== -1 && (a1 === -1 || o1 < a1)) { start = o1; open = "{"; }
  else if (a1 !== -1) { start = a1; open = "["; }
  if (start === -1) return null;

  // Match closing by counting braces/brackets
  let depth = 0, end = -1;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") depth--;
    if (depth === 0) { end = i; break; }
  }
  if (end === -1) return null;
  s = s.slice(start, end + 1);

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");

  try { return JSON.parse(s); } catch { return null; }
}
