import { describe, expect, it } from 'vitest';
import { HLD_PROBLEMS } from '../shared/hld/index.ts';
import { LLD_PROBLEMS } from '../shared/lld/index.ts';
import { emptyProgress } from '../server/store.ts';
import { problemView, revealHint } from '../server/trainer.ts';

const ALL_PROBLEMS = [...HLD_PROBLEMS, ...LLD_PROBLEMS];
const SLUG = 'design-a-url-shortener';

describe('hint content', () => {
  it.each(ALL_PROBLEMS.map((p) => [p.track, p.slug, p] as const))('%s/%s has exactly 3 real hints', (_track, _slug, p) => {
    expect(p.hints).toHaveLength(3);
    for (const hint of p.hints) {
      expect(hint.trim().length).toBeGreaterThan(20);
    }
  });

  it.each(ALL_PROBLEMS.map((p) => [p.track, p.slug, p] as const))('%s/%s hints get progressively more specific (later ones are not shorter than the first)', (_track, _slug, p) => {
    // A weak but useful guard against a "reversed" or duplicated hint ordering slipping in.
    expect(p.hints[2]!.length).toBeGreaterThanOrEqual(p.hints[0]!.length * 0.5);
  });
});

describe('revealHint', () => {
  it('reveals one more hint per call, in order, and never reveals more than exist', () => {
    const p = emptyProgress();
    expect(revealHint(p, 'hld', SLUG)).toHaveLength(1);
    expect(revealHint(p, 'hld', SLUG)).toHaveLength(2);
    expect(revealHint(p, 'hld', SLUG)).toHaveLength(3);
    expect(revealHint(p, 'hld', SLUG)).toHaveLength(3); // capped, not 4
  });

  it('returns exactly the problem\'s own hint text, in order', () => {
    const p = emptyProgress();
    const problem = HLD_PROBLEMS.find((q) => q.slug === SLUG)!;
    const revealed = revealHint(p, 'hld', SLUG);
    expect(revealed).toEqual([problem.hints[0]]);
  });

  it('keeps hld and lld hint progress in entirely separate buckets', () => {
    const p = emptyProgress();
    revealHint(p, 'hld', SLUG);
    revealHint(p, 'hld', SLUG);
    revealHint(p, 'lld', 'design-a-parking-lot');
    expect(p.hld[SLUG]!.hintsRevealed).toBe(2);
    expect(p.lld['design-a-parking-lot']!.hintsRevealed).toBe(1);
  });

  it('persists across a problemView call, without leaking unrevealed hints', () => {
    const p = emptyProgress();
    revealHint(p, 'hld', SLUG);
    const view = problemView(p, 'hld', SLUG);
    expect(view.totalHints).toBe(3);
    expect(view.revealedHints).toHaveLength(1);
    const problem = HLD_PROBLEMS.find((q) => q.slug === SLUG)!;
    expect(view.revealedHints[0]).toBe(problem.hints[0]);
    expect(view.revealedHints).not.toContain(problem.hints[1]);
    expect(view.revealedHints).not.toContain(problem.hints[2]);
  });

  it('a problem with no hints revealed yet reports zero, not undefined-crashes', () => {
    const p = emptyProgress();
    const view = problemView(p, 'hld', SLUG);
    expect(view.revealedHints).toEqual([]);
    expect(view.totalHints).toBe(3);
  });
});
