import type { SceneGraph } from '../scene/types.ts';

export type RubricVerdict = 'pass' | 'partial' | 'fail';

export interface RubricCheckResult {
  id: string;
  label: string;
  points: number;
  max: number;
  /** 'na' when the check didn't apply to this scene (e.g. a sharding-key check when only
   *  one datastore node was drawn) — excluded from both score and maxScore. */
  verdict: RubricVerdict | 'na';
  detail: string;
}

export interface RubricCheck {
  id: string;
  label: string;
  max: number;
  /** When present and false for a given scene, the check is skipped entirely (verdict 'na'). */
  applicable?: (graph: SceneGraph) => boolean;
  run: (graph: SceneGraph) => { points: number; verdict: RubricVerdict; detail: string };
}

export interface RubricSpec {
  id: string;
  title: string;
  checks: RubricCheck[];
}

export interface RubricResult {
  breakdown: RubricCheckResult[];
  score: number;
  maxScore: number;
  percent: number;
}
