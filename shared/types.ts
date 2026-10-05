import type { RubricCheckResult, RubricSpec } from './rubric/types.ts';
import type { Phase, PhaseInfo } from './timer/phases.ts';

export type Track = 'hld' | 'lld';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Tier = 'Not started' | 'Novice' | 'Learning' | 'Solid' | 'Strong' | 'Expert';

export interface PhaseTime {
  elapsedSec: number;
  activeSec: number;
}
export type PhaseTimes = Partial<Record<Phase, PhaseTime>>;
/** What you wrote in each 'text' phase's field (requirements, estimation, API, data model, trade-offs). */
export type PhaseAnswers = Partial<Record<Phase, string>>;

/** A curated design problem, HLD or LLD: the prompt, the rubric that grades a drawn scene
 *  against it, and the reference architecture revealed after the first attempt. */
export interface DesignProblem {
  slug: string;
  track: Track;
  title: string;
  difficulty: Difficulty;
  statement: string;
  rubric: RubricSpec;
  referenceApproach: string;
  /** Exactly 3, ordered vague -> specific. Answer-key content: server-only, revealed one at a time on request. */
  hints: string[];
}

export interface AttemptResult {
  slug: string;
  track: Track;
  title: string;
  score: number;
  maxScore: number;
  percent: number;
  breakdown: RubricCheckResult[];
  rated: boolean;
  ratingBefore: number;
  ratingAfter: number;
  referenceApproach: string;
  at: string;
  elapsedSec: number;
  activeSec: number;
  phaseTimes: PhaseTimes;
}

export interface PhaseAnalysisRow {
  phase: Phase;
  label: string;
  actualShare: number;
  recommendedShare: number;
  /** True when a phase ran well past its recommended budget share. */
  over: boolean;
}

/** What POST /score returns: the graded attempt plus a read on where the time went. */
export type ScoreResponse = AttemptResult & { phaseAnalysis: PhaseAnalysisRow[] };

/** A candidate's saved work and history on one problem — same shape for HLD and LLD. */
export interface ProblemProgress {
  attempts: number;
  bestPercent: number;
  lastPercent: number;
  lastAt: string;
  lastResult?: AttemptResult;
  /** Raw Excalidraw elements[] JSON — opaque here; only shared/scene parses it. */
  scene?: unknown;
  notes?: string;
  phaseTimes?: PhaseTimes;
  phaseAnswers?: PhaseAnswers;
  /** How many of the problem's 3 hints have been revealed. */
  hintsRevealed?: number;
  /** Where the phase wizard was when you left, so a reload resumes there instead of at phase 1. */
  currentPhase?: Phase;
  /** Phases already reviewed (advanced past) — the wizard's unlocked-tabs log. */
  reviewedPhases?: Phase[];
  /** The last AI review you got back, so it survives a reload (a real API call is costly to lose). */
  lastAiReview?: { text: string; model: string; at: string };
}

export interface Progress {
  version: 1;
  ratings: Partial<Record<Track, number>>;
  ratedAttempts: Partial<Record<Track, number>>;
  history: AttemptResult[];
  hld: Record<string, ProblemProgress>;
  lld: Record<string, ProblemProgress>;
}

export interface TrackSummary {
  track: Track;
  rating: number | null;
  tier: Tier;
  ratedAttempts: number;
}

export interface ProblemRow {
  slug: string;
  title: string;
  difficulty: Difficulty;
  attempts: number;
  bestPercent: number | null;
}

export interface DashboardState {
  tracks: TrackSummary[];
  recent: AttemptResult[];
  hldProblems: ProblemRow[];
  lldProblems: ProblemRow[];
}

export interface ProblemView {
  slug: string;
  track: Track;
  title: string;
  difficulty: Difficulty;
  statement: string;
  phases: PhaseInfo[];
  progress: ProblemProgress | null;
  /** Total hints this problem has (always 3 today). */
  totalHints: number;
  /** The text of the hints already revealed, in order — never the unrevealed ones. */
  revealedHints: string[];
  /** The last scored attempt (with time analysis), so the result survives a reload. */
  lastResult: ScoreResponse | null;
}
