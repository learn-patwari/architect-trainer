import { describe, expect, it } from 'vitest';
import { emptyProgress } from '../server/store.ts';
import { addPhaseTime, problemView, recordAttempt, saveAiReview, savePhaseState } from '../server/trainer.ts';

const SLUG = 'design-a-url-shortener';

const scene = [
  { id: 'a', type: 'rectangle', x: 0, y: 0, width: 100, height: 60, boundElements: [{ id: 'a-t', type: 'text' }] },
  { id: 'a-t', type: 'text', x: 0, y: 0, width: 80, height: 20, containerId: 'a', text: 'App Server' },
];

describe('resuming where you left off', () => {
  it('remembers the current phase and reviewed phases', () => {
    const p = emptyProgress();
    savePhaseState(p, 'hld', SLUG, { phase: 'api', reviewed: ['requirements', 'estimation'] });
    const view = problemView(p, 'hld', SLUG);
    expect(view.progress?.currentPhase).toBe('api');
    expect(view.progress?.reviewedPhases).toEqual(['requirements', 'estimation']);
  });

  it('rejects an unknown phase or a malformed reviewed list', () => {
    const p = emptyProgress();
    expect(() => savePhaseState(p, 'hld', SLUG, { phase: 'nope', reviewed: [] })).toThrow(/unknown phase/i);
    expect(() => savePhaseState(p, 'hld', SLUG, { phase: 'api', reviewed: ['nope'] })).toThrow(/reviewed/i);
    expect(() => savePhaseState(p, 'hld', SLUG, { phase: 'api', reviewed: 'requirements' })).toThrow(/reviewed/i);
  });

  it('keeps banked phase time across a phase-state save, and clears it only on an explicit reset', () => {
    const p = emptyProgress();
    addPhaseTime(p, 'hld', SLUG, { phaseSeconds: { requirements: { elapsedSec: 90, activeSec: 80 } } });
    savePhaseState(p, 'hld', SLUG, { phase: 'estimation', reviewed: ['requirements'] });
    expect(p.hld[SLUG]!.phaseTimes!.requirements!.elapsedSec).toBe(90);

    savePhaseState(p, 'hld', SLUG, { phase: 'requirements', reviewed: [], resetTimes: true });
    expect(p.hld[SLUG]!.phaseTimes).toEqual({});
    expect(p.hld[SLUG]!.currentPhase).toBe('requirements');
  });

  it('does not lose hints, notes or answers when the phase state is saved', () => {
    const p = emptyProgress();
    p.hld[SLUG] = { attempts: 0, bestPercent: 0, lastPercent: 0, lastAt: '', notes: 'n', hintsRevealed: 2, phaseAnswers: { requirements: 'r' } };
    savePhaseState(p, 'hld', SLUG, { phase: 'api', reviewed: [] });
    expect(p.hld[SLUG]).toMatchObject({ notes: 'n', hintsRevealed: 2, phaseAnswers: { requirements: 'r' } });
  });

  it('returns the last scored attempt, with its time analysis, in the problem view', () => {
    const p = emptyProgress();
    addPhaseTime(p, 'hld', SLUG, { phaseSeconds: { requirements: { elapsedSec: 60, activeSec: 60 } } });
    recordAttempt(p, 'hld', SLUG, scene);
    const view = problemView(p, 'hld', SLUG);
    expect(view.lastResult).not.toBeNull();
    expect(view.lastResult!.breakdown.length).toBeGreaterThan(0);
    expect(view.lastResult!.phaseAnalysis.length).toBeGreaterThan(0);
  });

  it('reports no last result before any attempt', () => {
    expect(problemView(emptyProgress(), 'hld', SLUG).lastResult).toBeNull();
  });

  it('stores the last AI review', () => {
    const p = emptyProgress();
    saveAiReview(p, 'hld', SLUG, { text: 'Verdict: borderline', model: 'm', at: 'now' });
    expect(p.hld[SLUG]!.lastAiReview!.text).toBe('Verdict: borderline');
  });
});
