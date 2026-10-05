import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS, TOOLS } from '../shared/tools/index.ts';

describe('tools content', () => {
  it('has unique slugs, all in a known category', () => {
    expect(new Set(TOOLS.map((t) => t.slug)).size).toBe(TOOLS.length);
    for (const t of TOOLS) {
      expect(Object.keys(CATEGORY_LABELS)).toContain(t.category);
    }
  });

  it.each(TOOLS.map((t) => [t.slug, t] as const))('%s has a real-world example naming an actual project or company', (_slug, t) => {
    expect(t.realWorldExample.trim().length).toBeGreaterThan(30);
  });

  it.each(TOOLS.map((t) => [t.slug, t] as const))('%s has good/bad lists, an operational cost, and a use-it-when scenario', (_slug, t) => {
    expect(t.goodAt.length).toBeGreaterThanOrEqual(1);
    expect(t.badAt.length).toBeGreaterThanOrEqual(1);
    expect(t.operationalCost.trim().length).toBeGreaterThan(10);
    expect(t.useWhen.trim().length).toBeGreaterThan(10);
  });
});
