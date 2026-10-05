import type { Difficulty, Tier } from './types.ts';

/**
 * Elo, ported unchanged from the DSA trainer: a problem is an "opponent" rated by
 * difficulty, your rubric percent on an attempt is the match result, and only the
 * first attempt at a problem is rated — after that you've seen the reference
 * architecture, so retakes are practice.
 */

export const START_RATING = 1200;
export const PROBLEM_RATING: Record<Difficulty, number> = { Easy: 1200, Medium: 1500, Hard: 1800 };

/** Elo expected score of a player rated `rating` against a problem of this difficulty. */
export function expectedScore(rating: number, difficulty: Difficulty): number {
  return 1 / (1 + 10 ** ((PROBLEM_RATING[difficulty] - rating) / 400));
}

/** K-factor: larger for the first few rated attempts on a track so ratings settle quickly. */
export function kFactor(ratedAttemptsSoFar: number): number {
  return ratedAttemptsSoFar < 3 ? 48 : 32;
}

/** New track rating after scoring `percent` (0-100) on a problem. */
export function updateRating(rating: number, difficulty: Difficulty, percent: number, ratedAttemptsSoFar: number): number {
  const actual = Math.min(1, Math.max(0, percent / 100));
  return Math.round(rating + kFactor(ratedAttemptsSoFar) * (actual - expectedScore(rating, difficulty)));
}

export function tierFor(rating: number | null): Tier {
  if (rating == null) return 'Not started';
  if (rating < 1250) return 'Novice';
  if (rating < 1400) return 'Learning';
  if (rating < 1550) return 'Solid';
  if (rating < 1700) return 'Strong';
  return 'Expert';
}
