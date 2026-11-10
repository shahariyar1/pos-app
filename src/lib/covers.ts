/** Shared by the API and the form. Pure functions, no server-only imports. */

/** "Y20 / Y21, A12" typed or pasted -> ["Y20", "Y21, A12"]. Split on "/" or new lines, drop blanks and duplicates. */
export function parseModelList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\/\n]+/)) {
    const m = raw.replace(/\s+/g, " ").trim();
    const key = m.toLowerCase();
    if (m && !seen.has(key)) {
      seen.add(key);
      out.push(m);
    }
  }
  return out;
}

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * A model matches when every word typed is found inside it, ignoring spaces and punctuation.
 * "y20" matches "vivo y20"; "c 31" matches "Realme c31"; "11 pro" matches "Redmi note 11 pro".
 */
export function modelMatches(model: string, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).map(compact).filter(Boolean);
  if (!tokens.length) return false;
  const hay = compact(model);
  const spaced = model.toLowerCase();
  return tokens.every((t) => hay.includes(t) || spaced.includes(t));
}
