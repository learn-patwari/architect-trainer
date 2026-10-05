import { PHASES } from './timer/phases.ts';
import type { AttemptResult, Difficulty, PhaseAnswers } from './types.ts';

/**
 * One prompt, two ways to use it: copy it into any chat window, or let the server
 * post it to a model you've configured — mirrors the DSA trainer's ai-prompt.ts.
 * The model gets the requirements, your notes, the diagram (as a structured
 * description, plus an image when the delivery path can carry one), and what the
 * deterministic rubric found — because a review of the drawing alone can't tell
 * you whether it matches what you actually meant.
 */

export interface ReviewContext {
  title: string;
  difficulty: Difficulty;
  statement: string;
  notes: string | null;
  /** What was written in each 'text' phase's field (requirements, estimation, API, data model, trade-offs). */
  phaseAnswers?: PhaseAnswers | null;
  sceneDescription: string;
  attempt: AttemptResult | null;
  /** Whether an image of the diagram accompanies this prompt (server-call path only). */
  hasImage: boolean;
}

const ROLE = `You are a staff engineer running a system design interview debrief. You are direct and specific, you never pad, and you would rather point out one real flaw than list five generic ones.`;

const TASK = `Review the candidate's system design below. Structure your answer with these headings, and keep the whole thing under 700 words:

**Verdict** — Would this pass a mid-level system design phone screen? One of: pass, borderline, fail. One sentence of justification.

**Requirements coverage** — Does the design actually satisfy the stated functional and non-functional requirements? Name anything missing, concretely.

**Architecture critique** — The real strengths and the real weaknesses of what was drawn, from someone who has run hundreds of these interviews. Do not pad with generic praise.

**Claimed vs. drawn** — The candidate's notes describe their intent. Does the diagram actually reflect that, or is there a gap between what they said and what they drew? A mismatch matters more than a missing box.

**The deterministic rubric vs. your judgment** — A mechanical rubric already checked structural things (load balancer placement, cache position, redundancy, labeling). Below is what it found. Does your own reading agree? More importantly, say what it couldn't see — a technically-present-but-wrong choice (e.g. a sharding key that would create a hot partition), or a needlessly over-engineered design.

**What to fix first** — The single highest-value change. Then at most two smaller ones.

**What they'd be asked next** — The natural deep-dive question an interviewer would ask about this design, and a one-line sketch of the answer.`;

function section(title: string, body: string | null | undefined): string {
  if (!body || !body.trim()) return '';
  return `\n## ${title}\n${body.trim()}\n`;
}

/** Joins every 'text' phase's written field into one write-up — the "split into parts, combine at the end" flow. */
function phaseWriteup(answers: PhaseAnswers | null | undefined): string {
  if (!answers) return '';
  const parts = PHASES.filter((p) => p.kind === 'text' && answers[p.id]?.trim()).map((p) => `### ${p.label}\n${answers[p.id]!.trim()}`);
  return parts.join('\n\n');
}

function rubricSection(attempt: AttemptResult | null): string {
  if (!attempt) return '';
  const lines = attempt.breakdown.map((c) => `- ${c.label}: ${c.verdict} (${c.points}/${c.max}) — ${c.detail}`);
  return section('What the deterministic rubric found', `Scored ${attempt.score}/${attempt.maxScore} (${attempt.percent}%).\n${lines.join('\n')}`);
}

export function buildReviewPrompt(ctx: ReviewContext): string {
  const header = `# ${ctx.title} (${ctx.difficulty})`;
  const imageNote = ctx.hasImage
    ? '\nA screenshot of the diagram is attached alongside this prompt.'
    : '\n(No image is attached — read the structured scene description below as the diagram.)';

  return [
    ROLE,
    '',
    TASK,
    '',
    '---',
    '',
    header,
    imageNote,
    section('Requirements', ctx.statement),
    section('The candidate\'s design write-up, by phase', phaseWriteup(ctx.phaseAnswers)),
    section('The diagram, as a structured description', ctx.sceneDescription),
    rubricSection(ctx.attempt),
    section("The candidate's notes", ctx.notes),
  ]
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
