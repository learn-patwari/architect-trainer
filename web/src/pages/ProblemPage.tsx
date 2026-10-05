import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { PHASES, type Phase } from '../../../shared/timer/phases.ts';
import type { PhaseAnswers, ProblemView, ScoreResponse, Track } from '../../../shared/types.ts';
import { api, useLoad } from '../api.ts';
import { DifficultyTag, ErrorBox, Loading, RatingDelta } from '../components.tsx';
import { AiReview } from '../hld/AiReview.tsx';
import { Canvas, type CanvasHandle } from '../hld/Canvas.tsx';
import { HintsPanel } from '../hld/HintsPanel.tsx';
import { NotesPopover } from '../hld/NotesPopover.tsx';
import { PhaseAnswerField } from '../hld/PhaseAnswerField.tsx';
import { PhaseTimerBar } from '../hld/PhaseTimerBar.tsx';
import { RubricResult } from '../hld/RubricResult.tsx';
import { usePhaseTimer } from '../hld/usePhaseTimer.ts';

/**
 * One page for both HLD and LLD: they share the exact same pipeline (statement,
 * notes, phase timer, Excalidraw canvas, rubric scoring, Elo, AI review) — only
 * the content and the scene's role vocabulary (infra vs. class-design) differ,
 * and that difference lives entirely in shared/, not here.
 */
export function ProblemPage() {
  const { track: trackParam = '', slug = '' } = useParams();
  const track = (trackParam === 'lld' ? 'lld' : 'hld') as Track;
  const { data, error, loading } = useLoad(() => api.problem(track, slug), [track, slug]);

  if (loading) {
    return (
      <main className="page">
        <Loading label="Loading problem…" />
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="page">
        <ErrorBox message={error ?? 'Failed to load.'} />
      </main>
    );
  }

  // Keyed by problem so moving to another one starts with that problem's own saved state.
  return <ProblemWorkspace key={`${track}/${slug}`} track={track} slug={slug} data={data} />;
}

/**
 * Mounted only once the saved state has loaded, so the timer, the wizard position, the
 * score result and the AI review can all start from what a previous session left behind —
 * a reload, a browser close, or a server restart resumes instead of starting over.
 */
function ProblemWorkspace({ track, slug, data }: { track: Track; slug: string; data: ProblemView }) {
  const canvasRef = useRef<CanvasHandle>(null);
  const timer = usePhaseTimer(true, { phase: data.progress?.currentPhase, phaseTimes: data.progress?.phaseTimes });
  // Seeded from the saved scene: Score must work straight after a reload, before the canvas has been touched.
  const elements = useRef<readonly unknown[]>((data.progress?.scene as unknown[] | undefined) ?? []);
  const [result, setResult] = useState<ScoreResponse | null>(data.lastResult);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [phaseAnswers, setPhaseAnswers] = useState<PhaseAnswers>(data.progress?.phaseAnswers ?? {});
  const [reviewed, setReviewed] = useState<Phase[]>(data.progress?.reviewedPhases ?? []);

  // Flush phase time periodically, and whenever the tab is hidden or closed — same
  // discipline as the DSA trainer's timer, so nothing is lost if the tab is just closed.
  useEffect(() => {
    const flush = () => {
      const delta = timer.takeUnflushed();
      if (Object.keys(delta).length > 0) void api.addTime(track, slug, delta).catch(() => {});
    };
    const id = setInterval(flush, 10_000);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      clearInterval(id);
      flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, slug]);

  // Remember which phase you're on and which you've reviewed. Skips the very first render,
  // where it would just write back exactly what was loaded.
  const savedPhaseState = useRef(JSON.stringify([data.progress?.currentPhase ?? PHASES[0]!.id, data.progress?.reviewedPhases ?? []]));
  useEffect(() => {
    const key = JSON.stringify([timer.phase, reviewed]);
    if (key === savedPhaseState.current) return;
    savedPhaseState.current = key;
    void api.savePhaseState(track, slug, timer.phase, reviewed).catch(() => {});
  }, [timer.phase, reviewed, track, slug]);

  const restartRound = () => {
    setReviewed([]);
    timer.restart();
    savedPhaseState.current = JSON.stringify([PHASES[0]!.id, []]);
    void api.savePhaseState(track, slug, PHASES[0]!.id, [], true).catch(() => {});
  };

  const onCanvasChange = (els: readonly unknown[]) => {
    elements.current = els;
    // Every change re-sends the whole scene, so a save dropped while the server was briefly down is repaired by the next edit.
    void api.saveScene(track, slug, els).catch(() => {});
  };

  const onPhaseAnswerChange = (phase: Phase, text: string) => setPhaseAnswers((prev) => ({ ...prev, [phase]: text }));

  const score = async () => {
    setScoring(true);
    setScoreError(null);
    try {
      setResult(await api.score(track, slug, elements.current));
    } catch (e) {
      setScoreError((e as Error).message);
    } finally {
      setScoring(false);
    }
  };

  const captureImage = async () => canvasRef.current?.exportImageBase64() ?? null;
  const hasAttempt = result != null || (data.progress?.attempts ?? 0) > 0;
  const currentPhase = PHASES.find((p) => p.id === timer.phase)!;
  const writeup = PHASES.filter((p) => p.kind === 'text' && phaseAnswers[p.id]?.trim());

  return (
    <main className="page page-wide">
      <div className="spread" style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>
          {data.title} <DifficultyTag difficulty={data.difficulty} /> <span className="tag tag-accent">{track.toUpperCase()}</span>
        </h1>
      </div>

      <div className="card phase-timer-top" style={{ marginBottom: '1rem' }}>
        <PhaseTimerBar timer={timer} reviewed={reviewed} onReviewedChange={setReviewed} onRestart={restartRound} />
      </div>

      <div className="split">
        <div className="stack sticky-col">
          <div className="card statement">
            <h2>Requirements</h2>
            <pre>{data.statement}</pre>
          </div>

          <div className="card">
            <HintsPanel track={track} slug={slug} totalHints={data.totalHints} initialRevealed={data.revealedHints} />
          </div>
        </div>

        <div className="stack">
          <div className="card">
            {currentPhase.kind === 'text' ? (
              <PhaseAnswerField
                track={track}
                slug={slug}
                phase={currentPhase.id}
                label={currentPhase.label}
                placeholder={currentPhase.placeholder}
                initial={phaseAnswers[currentPhase.id] ?? ''}
                onChange={onPhaseAnswerChange}
              />
            ) : (
              <div className="callout">
                <strong>{currentPhase.label}</strong> — draw it on the canvas below, then Review &amp; continue above when you're ready.
              </div>
            )}
          </div>

          <div className={`card canvas-card${currentPhase.kind === 'canvas' ? '' : ' canvas-card-hidden'}`} style={{ padding: 0 }}>
            <Canvas ref={canvasRef} initialElements={(data.progress?.scene as unknown[]) ?? []} onChange={onCanvasChange} />
          </div>

          <div className="card">
            <div className="spread">
              <h2 style={{ margin: 0 }}>Score my design</h2>
              <button className="btn btn-primary" onClick={score} disabled={scoring}>
                {scoring ? 'Scoring…' : 'Score my design'}
              </button>
            </div>
            {scoreError && <ErrorBox message={scoreError} />}
            {result && (
              <div className="stack" style={{ marginTop: '1rem' }}>
                {result.rated && (
                  <div className="tiny muted">
                    {track.toUpperCase()} rating {result.ratingBefore} → {result.ratingAfter} (
                    <RatingDelta before={result.ratingBefore} after={result.ratingAfter} />)
                  </div>
                )}
                <RubricResult score={result.score} maxScore={result.maxScore} percent={result.percent} breakdown={result.breakdown} />
                <details>
                  <summary className="small muted" style={{ cursor: 'pointer' }}>
                    Reference architecture
                  </summary>
                  <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
                    {result.referenceApproach}
                  </p>
                </details>
                {result.phaseAnalysis.length > 0 && (
                  <details>
                    <summary className="small muted" style={{ cursor: 'pointer' }}>
                      Where your time went
                    </summary>
                    <div className="stack" style={{ marginTop: '0.5rem' }}>
                      {result.phaseAnalysis.map((row) => (
                        <div className="spread" key={row.phase}>
                          <span>{row.label}</span>
                          <span className={row.over ? 'delta-down' : 'muted'}>
                            {Math.round(row.actualShare * 100)}% (budget {Math.round(row.recommendedShare * 100)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {writeup.length > 0 && (
                  <details>
                    <summary className="small muted" style={{ cursor: 'pointer' }}>
                      Your design write-up, combined
                    </summary>
                    <div className="stack" style={{ marginTop: '0.5rem' }}>
                      {writeup.map((p) => (
                        <div key={p.id}>
                          <div className="tiny muted" style={{ fontWeight: 600 }}>
                            {p.label}
                          </div>
                          <p className="small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                            {phaseAnswers[p.id]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h2>AI review</h2>
            <AiReview track={track} slug={slug} hasAttempt={hasAttempt} captureImage={captureImage} initialReview={data.progress?.lastAiReview?.text ?? null} />
          </div>
        </div>
      </div>

      <NotesPopover track={track} slug={slug} initial={data.progress?.notes ?? ''} />
    </main>
  );
}
