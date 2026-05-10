/**
 * Lightweight subsequence fuzzy scorer — no external dependencies.
 * Returns null if the query does not match; otherwise returns a positive
 * score where higher is better.
 *
 * Scoring:
 *   base = queryLength / (1 + totalGap)
 *   bonus ×2   — match at index 0
 *   bonus ×1.5 — match immediately after a word-boundary char (/ _ - space)
 */

const BOUNDARY_CHARS = new Set(["/", "_", "-", " ", "."]);

export function fuzzyScore(query: string, target: string): number | null {
  if (query.length === 0) return 1;

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  let qi = 0;
  let ti = 0;
  let totalGap = 0;
  let bonus = 1;

  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      if (ti === 0) bonus *= 2;
      else if (BOUNDARY_CHARS.has(t[ti - 1]!)) bonus *= 1.5;
      qi++;
    } else {
      totalGap++;
    }
    ti++;
  }

  if (qi < q.length) return null;

  return (q.length / (1 + totalGap)) * bonus;
}
