import { registryFor, getProblem as lookupProblem } from '../shared/problems.ts';
import type { ExcalidrawElement } from '../shared/scene/excalidraw-graph.ts';
import { parseScene } from '../shared/scene/excalidraw-graph.ts';
import { runRubric } from '../shared/rubric/run.ts';
import { START_RATING, tierFor, updateRating } from '../shared/scoring.ts';
import { PHASES, type Phase } from '../shared/timer/phases.ts';
import type {
  AttemptResult,
  DashboardState,
  DesignProblem,
  PhaseAnalysisRow,
  PhaseTimes,
  Progress,
  ProblemView,
  Track,
} from '../shared/types.ts';

const HISTORY_LIMIT = 1000;
const MAX_TIME_DELTA_SEC = 6 * 3600;
const PHASE_ID_SET = new Set<Phase>(PHASES.map((p) => p.id));

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function isTrack(v: unknown): v is Track {
  return v === 'hld' || v === 'lld';
}

export function requireTrack(v: string): Track {
  if (!isTrack(v)) throw new HttpError(404, `Unknown track "${v}" — expected "hld" or "lld".`);
  return v;
}

export function requireProblem(track: Track, slug: string): DesignProblem {
  const p = lookupProblem(track, slug);
  if (!p) throw new HttpError(404, `"${slug}" is not a known ${track.toUpperCase()} problem.`);
  return p;
}

function bucket(p: Progress, track: Track): Record<string, import('../shared/types.ts').ProblemProgress> {
  return track === 'hld' ? p.hld : p.lld;
}

function attempted(p: Progress, track: Track, slug: string): boolean {
  return (bucket(p, track)[slug]?.attempts ?? 0) > 0;
}

export function problemView(p: Progress, track: Track, slug: string): ProblemView {
  const problem = requireProblem(track, slug);
  const progress = bucket(p, track)[slug] ?? null;
  const revealed = Math.min(progress?.hintsRevealed ?? 0, problem.hints.length);
  return {
    slug,
    track,
    title: problem.title,
    difficulty: problem.difficulty,
    statement: problem.statement,
    phases: PHASES,
    progress,
    totalHints: problem.hints.length,
    revealedHints: problem.hints.slice(0, revealed),
    lastResult: progress?.lastResult ? { ...progress.lastResult, phaseAnalysis: phaseAnalysis(progress.lastResult.phaseTimes) } : null,
  };
}

/**
 * Remembers which phase the wizard is on and which have been reviewed, so a reload or
 * restart resumes there. `resetTimes` is for "Restart round": it also clears banked
 * phase time, otherwise a reload would resurrect the time from the round you threw away.
 */
export function savePhaseState(p: Progress, track: Track, slug: string, body: unknown): void {
  requireProblem(track, slug);
  const { phase, reviewed, resetTimes } = (body ?? {}) as { phase?: unknown; reviewed?: unknown; resetTimes?: unknown };
  if (!PHASE_ID_SET.has(phase as Phase)) throw new HttpError(400, `Unknown phase "${phase}".`);
  if (!Array.isArray(reviewed) || !reviewed.every((r) => PHASE_ID_SET.has(r as Phase))) throw new HttpError(400, '"reviewed" must be an array of phase ids.');
  const prior = bucket(p, track)[slug];
  bucket(p, track)[slug] = {
    ...blankProblemProgress(),
    ...prior,
    currentPhase: phase as Phase,
    reviewedPhases: [...new Set(reviewed as Phase[])],
    ...(resetTimes === true ? { phaseTimes: {} } : {}),
  };
}

export function saveAiReview(p: Progress, track: Track, slug: string, review: { text: string; model: string; at: string }): void {
  requireProblem(track, slug);
  bucket(p, track)[slug] = { ...blankProblemProgress(), ...bucket(p, track)[slug], lastAiReview: review };
}

function blankProblemProgress() {
  return { attempts: 0, bestPercent: 0, lastPercent: 0, lastAt: '' };
}

export function saveScene(p: Progress, track: Track, slug: string, scene: unknown): void {
  requireProblem(track, slug);
  const json = JSON.stringify(scene ?? []);
  if (json.length > 2_000_000) throw new HttpError(400, 'That scene is larger than 2 MB.');
  bucket(p, track)[slug] = { ...blankProblemProgress(), ...bucket(p, track)[slug], scene };
}

export function saveNotes(p: Progress, track: Track, slug: string, notes: unknown): void {
  requireProblem(track, slug);
  if (typeof notes !== 'string' || notes.length > 50_000) throw new HttpError(400, 'Notes must be a string under 50 KB.');
  bucket(p, track)[slug] = { ...blankProblemProgress(), ...bucket(p, track)[slug], notes };
}

/** Saves what was written in one 'text' phase's field (requirements, estimation, API, data model, trade-offs). */
export function savePhaseAnswer(p: Progress, track: Track, slug: string, phase: unknown, text: unknown): void {
  requireProblem(track, slug);
  if (!PHASE_ID_SET.has(phase as Phase)) throw new HttpError(400, `Unknown phase "${phase}".`);
  if (typeof text !== 'string' || text.length > 20_000) throw new HttpError(400, 'Phase text must be a string under 20 KB.');
  const prior = bucket(p, track)[slug];
  const phaseAnswers = { ...(prior?.phaseAnswers ?? {}), [phase as Phase]: text };
  bucket(p, track)[slug] = { ...blankProblemProgress(), ...prior, phaseAnswers };
}

/** Reveals the next hint (if any remain) and returns the hints revealed so far, in order. */
export function revealHint(p: Progress, track: Track, slug: string): string[] {
  const problem = requireProblem(track, slug);
  const prior = bucket(p, track)[slug];
  const revealed = Math.min((prior?.hintsRevealed ?? 0) + 1, problem.hints.length);
  bucket(p, track)[slug] = { ...blankProblemProgress(), ...prior, hintsRevealed: revealed };
  return problem.hints.slice(0, revealed);
}

/** Adds to a problem's running per-phase total. The client sends the delta since it last checked in. */
export function addPhaseTime(p: Progress, track: Track, slug: string, body: unknown): PhaseTimes {
  requireProblem(track, slug);
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'Expected a JSON body.');
  const deltas = (body as Record<string, unknown>).phaseSeconds;
  if (typeof deltas !== 'object' || deltas === null) throw new HttpError(400, '"phaseSeconds" must be an object keyed by phase id.');

  const clamp = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_TIME_DELTA_SEC, Math.max(0, Math.round(v))) : 0);
  const existing = bucket(p, track)[slug]?.phaseTimes ?? {};
  const next: PhaseTimes = { ...existing };

  for (const [phase, raw] of Object.entries(deltas as Record<string, unknown>)) {
    if (!PHASE_ID_SET.has(phase as Phase)) continue;
    const v = (raw ?? {}) as { elapsedSec?: unknown; activeSec?: unknown };
    const elapsed = clamp(v.elapsedSec);
    const active = Math.min(elapsed, clamp(v.activeSec)); // active time can't exceed the wall clock
    const prior = next[phase as Phase] ?? { elapsedSec: 0, activeSec: 0 };
    next[phase as Phase] = { elapsedSec: prior.elapsedSec + elapsed, activeSec: prior.activeSec + active };
  }

  bucket(p, track)[slug] = { ...blankProblemProgress(), ...bucket(p, track)[slug], phaseTimes: next };
  return next;
}

function totalSec(times: PhaseTimes): { elapsed: number; active: number } {
  let elapsed = 0;
  let active = 0;
  for (const v of Object.values(times)) {
    elapsed += v?.elapsedSec ?? 0;
    active += v?.activeSec ?? 0;
  }
  return { elapsed, active };
}

/** How your time was actually spent vs. the recommended share of a 45-minute round. */
export function phaseAnalysis(times: PhaseTimes): PhaseAnalysisRow[] {
  const { elapsed } = totalSec(times);
  if (elapsed === 0) return [];
  return PHASES.map((ph) => {
    const actual = times[ph.id]?.elapsedSec ?? 0;
    const actualShare = actual / elapsed;
    return { phase: ph.id, label: ph.label, actualShare, recommendedShare: ph.budgetShare, over: actualShare > ph.budgetShare * 1.5 };
  });
}

/**
 * Grades an attempt and records it. Only the FIRST attempt at a problem moves that
 * track's rating; later attempts are practice, since you've seen the reference architecture.
 */
export function recordAttempt(p: Progress, track: Track, slug: string, scene: unknown): AttemptResult {
  const problem = requireProblem(track, slug);
  const graph = parseScene(Array.isArray(scene) ? (scene as ExcalidrawElement[]) : []);
  if (graph.nodes.length === 0) throw new HttpError(400, 'Draw something before scoring.');

  const outcome = runRubric(problem.rubric, graph);
  const prior = bucket(p, track)[slug];
  const rated = !attempted(p, track, slug);
  const before = p.ratings[track] ?? START_RATING;
  const ratedSoFar = p.ratedAttempts[track] ?? 0;
  const after = rated ? updateRating(before, problem.difficulty, outcome.percent, ratedSoFar) : before;
  const times = prior?.phaseTimes ?? {};
  const { elapsed, active } = totalSec(times);

  const result: AttemptResult = {
    slug,
    track,
    title: problem.title,
    score: outcome.score,
    maxScore: outcome.maxScore,
    percent: outcome.percent,
    breakdown: outcome.breakdown,
    rated,
    ratingBefore: before,
    ratingAfter: after,
    referenceApproach: problem.referenceApproach,
    at: new Date().toISOString(),
    elapsedSec: elapsed,
    activeSec: active,
    phaseTimes: times,
  };

  if (rated) {
    p.ratings[track] = after;
    p.ratedAttempts[track] = ratedSoFar + 1;
  }
  bucket(p, track)[slug] = {
    ...blankProblemProgress(),
    ...prior,
    attempts: (prior?.attempts ?? 0) + 1,
    bestPercent: Math.max(prior?.bestPercent ?? 0, outcome.percent),
    lastPercent: outcome.percent,
    lastAt: result.at,
    lastResult: result,
    scene,
  };
  p.history.push(result);
  if (p.history.length > HISTORY_LIMIT) p.history.splice(0, p.history.length - HISTORY_LIMIT);
  return result;
}

export function dashboard(p: Progress): DashboardState {
  const tracks: Track[] = ['hld', 'lld'];
  return {
    tracks: tracks.map((t) => ({
      track: t,
      rating: p.ratings[t] ?? null,
      tier: tierFor(p.ratings[t] ?? null),
      ratedAttempts: p.ratedAttempts[t] ?? 0,
    })),
    recent: p.history.slice(-8).reverse(),
    hldProblems: registryFor('hld').map((q) => ({
      slug: q.slug,
      title: q.title,
      difficulty: q.difficulty,
      attempts: p.hld[q.slug]?.attempts ?? 0,
      bestPercent: attempted(p, 'hld', q.slug) ? (p.hld[q.slug]?.bestPercent ?? 0) : null,
    })),
    lldProblems: registryFor('lld').map((q) => ({
      slug: q.slug,
      title: q.title,
      difficulty: q.difficulty,
      attempts: p.lld[q.slug]?.attempts ?? 0,
      bestPercent: attempted(p, 'lld', q.slug) ? (p.lld[q.slug]?.bestPercent ?? 0) : null,
    })),
  };
}
