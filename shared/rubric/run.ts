import type { SceneGraph } from '../scene/types.ts';
import type { RubricCheckResult, RubricResult, RubricSpec } from './types.ts';

/** Runs every check in a spec against a scene graph. Never imported by web/. */
export function runRubric(spec: RubricSpec, graph: SceneGraph): RubricResult {
  const breakdown: RubricCheckResult[] = [];
  let score = 0;
  let maxScore = 0;

  for (const check of spec.checks) {
    if (check.applicable && !check.applicable(graph)) {
      breakdown.push({ id: check.id, label: check.label, points: 0, max: check.max, verdict: 'na', detail: 'Not applicable to this design.' });
      continue;
    }
    const r = check.run(graph);
    breakdown.push({ id: check.id, label: check.label, points: r.points, max: check.max, verdict: r.verdict, detail: r.detail });
    score += r.points;
    maxScore += check.max;
  }

  const percent = maxScore === 0 ? 0 : Math.round((100 * score) / maxScore);
  return { breakdown, score: round2(score), maxScore, percent };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
