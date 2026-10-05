import { describe, expect, it } from 'vitest';
import { emptyProgress } from '../server/store.ts';
import { savePhaseAnswer } from '../server/trainer.ts';

const SLUG = 'design-a-url-shortener';

describe('phase answers', () => {
  it('saves and overwrites one phase\'s text', () => {
    const p = emptyProgress();
    savePhaseAnswer(p, 'hld', SLUG, 'requirements', 'Reads dominate writes 100:1.');
    expect(p.hld[SLUG]!.phaseAnswers!.requirements).toBe('Reads dominate writes 100:1.');
    savePhaseAnswer(p, 'hld', SLUG, 'requirements', 'Updated.');
    expect(p.hld[SLUG]!.phaseAnswers!.requirements).toBe('Updated.');
  });

  it('keeps every phase\'s answer independent of the others', () => {
    const p = emptyProgress();
    savePhaseAnswer(p, 'hld', SLUG, 'requirements', 'A');
    savePhaseAnswer(p, 'hld', SLUG, 'estimation', 'B');
    expect(p.hld[SLUG]!.phaseAnswers).toEqual({ requirements: 'A', estimation: 'B' });
  });

  it('keeps hld and lld phase answers in entirely separate buckets', () => {
    const p = emptyProgress();
    savePhaseAnswer(p, 'hld', SLUG, 'requirements', 'HLD answer');
    savePhaseAnswer(p, 'lld', 'design-a-parking-lot', 'requirements', 'LLD answer');
    expect(p.hld[SLUG]!.phaseAnswers!.requirements).toBe('HLD answer');
    expect(p.lld['design-a-parking-lot']!.phaseAnswers!.requirements).toBe('LLD answer');
  });

  it('rejects an unknown phase', () => {
    const p = emptyProgress();
    expect(() => savePhaseAnswer(p, 'hld', SLUG, 'not-a-phase', 'x')).toThrow(/unknown phase/i);
  });

  it('rejects non-string text', () => {
    const p = emptyProgress();
    expect(() => savePhaseAnswer(p, 'hld', SLUG, 'requirements', 42)).toThrow(/must be a string/i);
  });
});
