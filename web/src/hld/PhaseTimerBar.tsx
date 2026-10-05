import { PHASES, type Phase } from '../../../shared/timer/phases.ts';
import { formatDuration } from '../components.tsx';
import type { UsePhaseTimer } from './usePhaseTimer.ts';

interface Props {
  timer: UsePhaseTimer;
  /** Phases already advanced past. Owned by the page, which persists it so a reload keeps the unlocked tabs. */
  reviewed: Phase[];
  onReviewedChange: (next: Phase[]) => void;
  onRestart: () => void;
}

/**
 * A sequential wizard, not a free-click tab row: phases you haven't reached yet
 * are locked. "Review & continue" banks the current phase's time, drops it into
 * the reviewed log below, and advances — the requirements-gathering-style
 * "look at what I did, then move on" flow. You can still click back onto any
 * phase you've already reached (to review it or add more time), just not skip
 * ahead of where you are.
 */
export function PhaseTimerBar({ timer, reviewed, onReviewedChange, onRestart }: Props) {
  const { status, phase, away, autoPaused, elapsedSec, totalElapsedSec, totalActiveSec, setPhase, pause, resume, stop } = timer;

  const currentIndex = PHASES.findIndex((p) => p.id === phase);
  const current = PHASES[currentIndex]!;
  const next = PHASES[currentIndex + 1];
  const isLast = next == null;
  const reachedIds = new Set(reviewed);

  const advance = () => {
    onReviewedChange([...reviewed.filter((r) => r !== current.id), current.id]);
    if (next) setPhase(next.id);
  };

  const jumpTo = (p: Phase, locked: boolean) => {
    if (!locked) setPhase(p);
  };

  return (
    <div className="timer phase-timer" role="group" aria-label="Phase timer">
      <div className="phase-tabs">
        {PHASES.map((p, i) => {
          const locked = i > currentIndex && !reachedIds.has(p.id);
          const isCurrent = p.id === phase;
          const done = !isCurrent && (i < currentIndex || reachedIds.has(p.id));
          return (
            <button
              key={p.id}
              className={`phase-tab ${isCurrent ? 'current' : ''} ${done ? 'done' : ''} ${locked ? 'locked' : ''}`}
              onClick={() => jumpTo(p.id, locked)}
              disabled={locked}
              title={locked ? 'Not reached yet' : `${formatDuration(elapsedSec[p.id])} on this phase so far`}
            >
              <span className="phase-tab-index">{done ? '✓' : i + 1}</span>
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="phase-current">
        <div className="spread">
          <div>
            <div className="tiny muted">
              Phase {currentIndex + 1} of {PHASES.length}
            </div>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>
              {current.label}
            </div>
          </div>
          <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            {formatDuration(elapsedSec[current.id])}
          </div>
        </div>

        <div className="row" style={{ marginTop: '0.6rem' }}>
          {status === 'running' && (
            <button className="btn btn-sm" onClick={pause}>
              Pause
            </button>
          )}
          {(status === 'paused' || status === 'idle') && (
            <button className="btn btn-sm" onClick={resume}>
              {status === 'idle' ? 'Start' : 'Resume'}
            </button>
          )}
          {status === 'stopped' ? (
            <button className="btn btn-sm" onClick={onRestart}>
              Restart
            </button>
          ) : (
            <button className="btn btn-sm" onClick={stop} disabled={status === 'idle'}>
              Stop
            </button>
          )}
          {!isLast && (
            <button className="btn btn-primary btn-sm" onClick={advance}>
              Review &amp; continue to {next!.label} →
            </button>
          )}
        </div>

        <div className="tiny muted" style={{ marginTop: '0.4rem' }}>
          {status === 'running' && away && 'Held — this tab is in the background.'}
          {status === 'paused' && (autoPaused ? 'Paused — picked up where you left off. Press Resume to keep the clock going.' : 'Paused.')}
          {status === 'stopped' && 'Stopped.'}
          {status === 'idle' && 'Not started.'}
          {isLast && status === 'running' && !away && " Last phase — score your design below when you're ready."}
        </div>
      </div>

      {reviewed.length > 0 && (
        <div className="phase-reviewed">
          <div className="ref-h">Reviewed</div>
          {PHASES.filter((p) => reachedIds.has(p.id)).map((p) => (
            <div className="spread small" key={p.id}>
              <span>✓ {p.label}</span>
              <span className="mono muted">{formatDuration(elapsedSec[p.id])}</span>
            </div>
          ))}
        </div>
      )}

      <div className="tiny muted" style={{ marginTop: '0.5rem', textAlign: 'right' }}>
        Total {formatDuration(totalElapsedSec)} ({formatDuration(totalActiveSec)} active)
      </div>
    </div>
  );
}
