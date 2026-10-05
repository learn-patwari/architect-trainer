import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS, CONCEPTS } from '../shared/concepts/index.ts';

describe('concepts content', () => {
  it('has unique slugs, all in a known category', () => {
    expect(new Set(CONCEPTS.map((c) => c.slug)).size).toBe(CONCEPTS.length);
    for (const c of CONCEPTS) {
      expect(Object.keys(CATEGORY_LABELS)).toContain(c.category);
    }
  });

  it.each(CONCEPTS.map((c) => [c.slug, c] as const))('%s has a worked example and at least one further-reading link', (_slug, c) => {
    expect(c.example.trim().length).toBeGreaterThan(20);
    expect(c.furtherReading.length).toBeGreaterThanOrEqual(1);
    for (const link of c.furtherReading) {
      expect(link.label.trim().length).toBeGreaterThan(0);
      expect(link.url).toMatch(/^https:\/\//);
    }
  });

  it.each(CONCEPTS.map((c) => [c.slug, c] as const))('%s has a well-formed explanation and pitfalls', (_slug, c) => {
    expect(c.explanation.trim().length).toBeGreaterThan(50);
    expect(c.interviewCue.trim().length).toBeGreaterThan(10);
    expect(c.pitfalls.length).toBeGreaterThanOrEqual(2);
  });

  it.each(CONCEPTS.filter((c) => c.category === 'oop-design').map((c) => [c.slug, c] as const))(
    '%s (an OOP/design-pattern concept) has a real code example, not just prose',
    (_slug, c) => {
      expect(c.codeExample, `${c.slug} is missing a codeExample`).toBeDefined();
      expect(c.codeExample!.language.trim().length).toBeGreaterThan(0);
      expect(c.codeExample!.code.trim().length).toBeGreaterThan(60);
      // A real code snippet has more than one line — guards against a one-liner stand-in.
      expect(c.codeExample!.code.trim().split('\n').length).toBeGreaterThan(3);
    },
  );
});
