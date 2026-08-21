export interface FuzzyMatchResult {
  matched: boolean;
  score: number;
}

/**
 * Case-insensitive subsequence match — every query character must appear in
 * order in the target; contiguous runs score higher than scattered ones.
 * Good enough for name/NORAD-ID search without a new dependency.
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatchResult {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return { matched: true, score: 0 };

  let queryIndex = 0;
  let score = 0;
  let streak = 0;

  for (let targetIndex = 0; targetIndex < t.length && queryIndex < q.length; targetIndex++) {
    if (t[targetIndex] === q[queryIndex]) {
      streak += 1;
      score += streak;
      queryIndex += 1;
    } else {
      streak = 0;
    }
  }

  return { matched: queryIndex === q.length, score };
}
