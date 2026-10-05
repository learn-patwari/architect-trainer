import { getHldProblem, HLD_PROBLEMS } from './hld/index.ts';
import { getLldProblem, LLD_PROBLEMS } from './lld/index.ts';
import type { DesignProblem, Track } from './types.ts';

/** Looks up the right registry/problem for a track, so server code needn't branch on it directly. */
export function registryFor(track: Track): DesignProblem[] {
  return track === 'hld' ? HLD_PROBLEMS : LLD_PROBLEMS;
}

export function getProblem(track: Track, slug: string): DesignProblem | undefined {
  return track === 'hld' ? getHldProblem(slug) : getLldProblem(slug);
}
