import { describe, expect, it } from 'vitest';
import { CONCEPTS } from '../shared/concepts/index.ts';
import { getProblem } from '../shared/problems.ts';
import { STUDY_PLAN } from '../shared/study-plan/index.ts';

const CONCEPT_SLUGS = new Set(CONCEPTS.map((c) => c.slug));

describe('study plan', () => {
  const steps = STUDY_PLAN.flatMap((phase) => phase.steps);

  it('has no duplicate step ids across phases', () => {
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every "problem" step points at a problem that actually exists', () => {
    for (const step of steps.filter((s) => s.kind === 'problem')) {
      expect(step.track, `${step.id} is missing a track`).toBeDefined();
      expect(step.slug, `${step.id} is missing a slug`).toBeDefined();
      const problem = getProblem(step.track!, step.slug!);
      expect(problem, `${step.id} references ${step.track}/${step.slug}, which doesn't exist`).toBeDefined();
      expect(step.href).toBe(`/problems/${step.track}/${step.slug}`);
    }
  });

  it('every "concept" step points at a concept that actually exists', () => {
    for (const step of steps.filter((s) => s.kind === 'concept')) {
      const slug = step.href.replace('/concepts/', '');
      expect(CONCEPT_SLUGS.has(slug), `${step.id} links to /concepts/${slug}, which doesn't exist`).toBe(true);
    }
  });

  it('every phase has at least one step', () => {
    for (const phase of STUDY_PLAN) {
      expect(phase.steps.length).toBeGreaterThan(0);
    }
  });
});
