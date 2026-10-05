import { describe, expect, it } from 'vitest';
import { emptyProgress } from '../server/store.ts';
import { addPhaseTime, phaseAnalysis } from '../server/trainer.ts';

const SLUG = 'design-a-url-shortener';

describe('phase time accounting', () => {
  it('accumulates deltas per phase across calls', () => {
    const p = emptyProgress();
    addPhaseTime(p, 'hld', SLUG, { phaseSeconds: { requirements: { elapsedSec: 60, activeSec: 55 } } });
    addPhaseTime(p, 'hld', SLUG, { phaseSeconds: { requirements: { elapsedSec: 30, activeSec: 30 }, 'high-level': { elapsedSec: 100, activeSec: 90 } } });
    const times = p.hld[SLUG]!.phaseTimes!;
    expect(times.requirements).toEqual({ elapsedSec: 90, activeSec: 85 });
    expect(times['high-level']).toEqual({ elapsedSec: 100, activeSec: 90 });
  });

  it('clamps active seconds to never exceed elapsed seconds', () => {
    const p = emptyProgress();
    addPhaseTime(p, 'hld', SLUG, { phaseSeconds: { requirements: { elapsedSec: 10, activeSec: 999 } } });
    expect(p.hld[SLUG]!.phaseTimes!.requirements).toEqual({ elapsedSec: 10, activeSec: 10 });
  });

  it('ignores unknown phase ids', () => {
    const p = emptyProgress();
    addPhaseTime(p, 'hld', SLUG, { phaseSeconds: { 'not-a-real-phase': { elapsedSec: 10, activeSec: 10 } } });
    expect(p.hld[SLUG]?.phaseTimes ?? {}).toEqual({});
  });

  it('rejects a body with no phaseSeconds object', () => {
    const p = emptyProgress();
    expect(() => addPhaseTime(p, 'hld', SLUG, {})).toThrow(/phaseSeconds/);
  });

  it('keeps hld and lld phase time in entirely separate buckets', () => {
    const p = emptyProgress();
    addPhaseTime(p, 'hld', SLUG, { phaseSeconds: { requirements: { elapsedSec: 10, activeSec: 10 } } });
    addPhaseTime(p, 'lld', 'design-a-parking-lot', { phaseSeconds: { requirements: { elapsedSec: 20, activeSec: 20 } } });
    expect(p.hld[SLUG]!.phaseTimes!.requirements!.elapsedSec).toBe(10);
    expect(p.lld['design-a-parking-lot']!.phaseTimes!.requirements!.elapsedSec).toBe(20);
    expect(p.hld['design-a-parking-lot']).toBeUndefined();
    expect(p.lld[SLUG]).toBeUndefined();
  });

  it('flags a phase that ran well over its recommended budget share', () => {
    const rows = phaseAnalysis({ requirements: { elapsedSec: 1000, activeSec: 1000 }, 'high-level': { elapsedSec: 100, activeSec: 100 } });
    expect(rows.find((r) => r.phase === 'requirements')!.over).toBe(true);
    expect(rows.find((r) => r.phase === 'deep-dive')!.over).toBe(false);
  });

  it('returns nothing when no time has been logged', () => {
    expect(phaseAnalysis({})).toEqual([]);
  });
});
