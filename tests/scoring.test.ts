import { describe, expect, it } from 'vitest';
import { expectedScore, kFactor, START_RATING, tierFor, updateRating } from '../shared/scoring.ts';

describe('scoring', () => {
  it('expectedScore is 0.5 when rating equals the opponent', () => {
    expect(expectedScore(1500, 'Medium')).toBeCloseTo(0.5, 5);
  });

  it('kFactor is larger for the first few rated attempts', () => {
    expect(kFactor(0)).toBe(48);
    expect(kFactor(2)).toBe(48);
    expect(kFactor(3)).toBe(32);
  });

  it('updateRating increases rating on a strong result against a higher-rated problem', () => {
    expect(updateRating(1200, 'Medium', 90, 0)).toBeGreaterThan(1200);
  });

  it('updateRating decreases rating on a weak result against a lower-rated problem', () => {
    expect(updateRating(1800, 'Easy', 20, 0)).toBeLessThan(1800);
  });

  it('tierFor maps ranges correctly', () => {
    expect(tierFor(null)).toBe('Not started');
    expect(tierFor(1200)).toBe('Novice');
    expect(tierFor(1300)).toBe('Learning');
    expect(tierFor(1450)).toBe('Solid');
    expect(tierFor(1600)).toBe('Strong');
    expect(tierFor(1750)).toBe('Expert');
  });

  it('START_RATING is 1200', () => {
    expect(START_RATING).toBe(1200);
  });
});
