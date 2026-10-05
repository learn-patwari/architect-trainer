import { describe, expect, it } from 'vitest';
import { estimate } from '../shared/estimate/calc.ts';
import { ESTIMATE_SCENARIOS } from '../shared/estimate/scenarios.ts';

describe('estimate reference scenarios', () => {
  it('has unique ids and a real description for each scenario', () => {
    expect(new Set(ESTIMATE_SCENARIOS.map((s) => s.id)).size).toBe(ESTIMATE_SCENARIOS.length);
    for (const s of ESTIMATE_SCENARIOS) {
      expect(s.description.trim().length).toBeGreaterThan(20);
    }
  });

  it('every scenario produces a valid, positive estimate', () => {
    for (const s of ESTIMATE_SCENARIOS) {
      const r = estimate(s.input);
      expect(r.avgQps).toBeGreaterThan(0);
      expect(r.peakQps).toBeGreaterThanOrEqual(r.avgQps);
      expect(r.storageGbTotal).toBeGreaterThan(0);
      expect(r.serversNeeded).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(r.monthlyTotalCost)).toBe(true);
    }
  });

  it('the url-shortener scenario lands close to ~100M new links a month, matching the HLD problem it mirrors', () => {
    const scenario = ESTIMATE_SCENARIOS.find((s) => s.id === 'url-shortener')!;
    const monthlyWrites = scenario.input.users * scenario.input.writesPerUserPerDay * 30;
    expect(monthlyWrites).toBeGreaterThan(80_000_000);
    expect(monthlyWrites).toBeLessThan(120_000_000);
  });
});
